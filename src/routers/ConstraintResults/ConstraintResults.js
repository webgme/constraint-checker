/*globals define*/
/*jshint node:true*/

/**
 * Router that forwards requests for status and results generated by the webhook.
 * Its main purpose is to authenticate the user and ensure that he/she has read access to the project in question.
 */

'use strict';

// http://expressjs.com/en/guide/routing.html
var express = require('express'),
    superagent = require('superagent'),
    Q = require('q'),
    router = express.Router(),
    path = require('path'),
    STORAGE_CONSTANTS = requireJS('common/storage/constants'),
    getProjectId = requireJS('common/storage/util').getProjectIdFromOwnerIdAndProjectName,
    componentJson = require(path.join(process.cwd(), 'config', 'components.json')),
    // Allow settings on global for tests.
    hookConfig = global.constraintCheckerHookConfig || componentJson.ConstraintCheckerHook ||
        require(path.join('..', '..', '..', 'config', 'components.json')).ConstraintCheckerHook,
    HOOK_BASE_URL = hookConfig.origin + ':' + hookConfig.port + '/' + hookConfig.id;


/**
 * Called when the server is created but before it starts to listening to incoming requests.
 * N.B. gmeAuth, safeStorage and workerManager are not ready to use until the start function is called.
 * (However inside an incoming request they are all ensured to have been initialized.)
 *
 * @param {object} middlewareOpts - Passed by the webgme server.
 * @param {GmeConfig} middlewareOpts.gmeConfig - GME config parameters.
 * @param {GmeLogger} middlewareOpts.logger - logger
 * @param {function} middlewareOpts.ensureAuthenticated - Ensures the user is authenticated.
 * @param {function} middlewareOpts.getUserId - If authenticated retrieves the userId from the request.
 * @param {object} middlewareOpts.gmeAuth - Authorization module.
 * @param {object} middlewareOpts.safeStorage - Accesses the storage and emits events (PROJECT_CREATED, COMMIT..).
 * @param {object} middlewareOpts.workerManager - Spawns and keeps track of "worker" sub-processes.
 */
function initialize(middlewareOpts) {
    var logger = middlewareOpts.logger.fork('ConstraintResults'),
        ensureAuthenticated = middlewareOpts.ensureAuthenticated,
        getUserId = middlewareOpts.getUserId,
        gmeAuth = middlewareOpts.gmeAuth,
        gmeConfig = middlewareOpts.gmeConfig,
        storage = middlewareOpts.safeStorage;

    logger.debug('initializing ...');

    // Ensure authenticated can be used only after this rule.
    router.use('*', ensureAuthenticated, function (req, res, next) {
        // TODO: set all headers, check rate limit, etc.

        // This header ensures that any failures with authentication won't redirect.
        res.setHeader('X-WebGME-Media-Type', 'webgme.v1');
        next();
    });

    router.get('/webhookStatus', function (req, res, next) {
        var hookUrl = [
            HOOK_BASE_URL,
            'status'
        ].join('/'),
            userId = getUserId(req),
            ensureUserAllowed;

        if (gmeConfig.authentication.enable === true) {
            ensureUserAllowed = gmeAuth.getUser(userId)
                .then(function (data) {
                    if (!data.siteAdmin) {
                        throw new Error('Site admin required');
                    }
                })
        } else {
            ensureUserAllowed = new Q();
        }

        ensureUserAllowed
            .then(function () {
                superagent.get(hookUrl).end(function (err, data) {
                    if (err) {
                        res.json({error: 'No response from webhook!', errMessage: err.message});
                    } else {
                        res.json(data.body);
                    }
                });
            })
            .catch(next);
    });

    router.get('/:ownerId/:projectName/:type/:commitHash', function (req, res, next) {
        var hookUrl = [
            HOOK_BASE_URL,
            req.params.ownerId,
            req.params.projectName,
            req.params.type, // status or result
            req.params.commitHash
        ].join('/'),
            projectAuthParams = {
                entityType: gmeAuth.authorizer.ENTITY_TYPES.PROJECT
            },
            userId = getUserId(req),
            projectId = getProjectId(req.params.ownerId, req.params.projectName);

        gmeAuth.authorizer.getAccessRights(userId, projectId, projectAuthParams)
            .then(function (rights) {
                if (rights && rights.read === true) {
                    superagent.get(hookUrl).end(function (err, data) {
                        if (err) {
                            next(err);
                        } else {
                            res.json(data.body);
                        }
                    });
                } else {
                    res.sendStatus(403);
                }
            })
            .catch(next);
    });

    if (hookConfig.addAtProjectCreation === true) {
        logger.info('Will add Constraint Checker Hook to new projects');
        storage.addEventListener(STORAGE_CONSTANTS.PROJECT_CREATED, function (_storage, data) {
            gmeAuth.metadataStorage.getProject(data.projectId)
                .then(function (projectData) {
                    var now = (new Date()).toISOString(),
                        hooks = projectData.hooks || {};

                    hooks[hookConfig.id] = {
                        url: HOOK_BASE_URL,
                        description: hookConfig.description,
                        events: hookConfig.events,
                        active: hookConfig.activeAtProjectCreation,
                        createdAt: now,
                        updatedAt: now
                    };

                    return gmeAuth.metadataStorage.updateProjectHooks(data.projectId, hooks);
                })
                .catch(function (err) {
                    logger.error('Failed to add constrain checker hook at project creation', err);
                });
        });
    }
}

/**
 * Called before the server starts listening.
 * @param {function} callback
 */
function start(callback) {
    callback();
}

/**
 * Called after the server stopped listening.
 * @param {function} callback
 */
function stop(callback) {
    callback();
}


module.exports = {
    initialize: initialize,
    router: router,
    start: start,
    stop: stop
};
