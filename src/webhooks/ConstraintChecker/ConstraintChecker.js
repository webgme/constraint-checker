/*jshint node: true*/
/**
 *
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var webgme = require('webgme'),
    Express = require('express'),
    path = require('path'),
    Q = require('q'),
    bodyParser = require('body-parser'),
    mongodb = require('mongodb'),
    binRunPlugin = require('webgme/src/bin/run_plugin'),
    configDir = path.join(process.cwd(), 'config'),
    gmeConfig = require(configDir),
    componentJson = require(path.join(process.cwd(), 'config', 'components.json')),
    hookConfig = global.constraintCheckerHookConfig || componentJson.ConstraintCheckerHook ||
        require(path.join('..', '..', '..', 'config', 'components.json')).ConstraintCheckerHook,
    HOOK_ID = hookConfig.id,
    logger = webgme.Logger.create('gme:' + HOOK_ID, gmeConfig.bin.log, false);


webgme.addToRequireJsPaths(gmeConfig);

/**
 * @param {string} [options.port] - Port for server
 * @param {string} [options.mongoUri]
 * @constructor
 */
function Handler(options) {
    var app = new Express(),
        db,
        results = [],
        serverUrl,
        server;

    if (gmeConfig.webhooks.enable !== true) {
        throw new Error('gmeConfig.webhooks.enable must be true in order to dispatch events from the webgme server!');
    }

    options.mongoUri = options.mongoUri || hookConfig.mongoUri;
    options.port = options.port || hookConfig.port;

    function runPlugin(payload) {
        var args = ['node', 'dummy.js', 'ConstraintChecker', payload.projectName],
            result = {
                payload: payload,
                pluginResult: null,
                exception: null
            };

        results.unshift(result);

        if (results.length > 100) {
            results.pop();
        }

        args = args.concat([
            '-o', payload.owner,
            '-u', payload.data.userId,
            '-c', payload.data.commitHash
        ]);

        return binRunPlugin.main(args)
            .then(function (pluginResult) {
                result.pluginResult = pluginResult;
                logger.debug(JSON.stringify(pluginResult, null, 2));

                if (pluginResult.success === true) {
                    logger.debug('success');
                } else if (pluginResult.error) {
                    logger.error('Unexpected error:');
                    logger.error(JSON.stringify(pluginResult, null, 2));
                } else {
                    logger.debug('constraints not met');
                }
            })
            .catch(function (err) {
                result.exception = err.stack;
                logger.error('EXCEPTION:', err);
            });
    }

    this.start = function (callback) {
        var deferred = Q.defer();
        // Start server and connect to mongodb // connection will be available at global.db.

        app.use(bodyParser.json());

        app.post('/' + HOOK_ID, function (req, res) {
            var payload = req.body;
            logger.debug('hook triggered');
            if (payload.event === 'COMMIT') {
                runPlugin(payload)
                    .finally(function () {
                        logger.debug('done');
                    });
            } else {
                logger.warn('Unexpected event', JSON.stringify(payload));
            }

            res.sendStatus(200);
        });

        app.get('/' + HOOK_ID + '/:ownerId/:projectName/status/:commitHash', function (req, res, next) {
            var collection = db.collection(req.params.ownerId + '+' + req.params.projectName);
            collection.findOne({_id: '#' + req.params.commitHash})
                .then(function (result) {
                    var status = {
                        exists: false,
                        isRunning: false,
                        metaInconsistent: false,
                        hasViolation: false
                    };

                    if (result) {
                        status.exists = true;
                        status.isRunning = result.isRunning;
                        status.metaInconsistent = result.metaInconsistent;
                        status.hasViolation = result.hasViolation;
                    }

                    res.json(status);
                })
                .catch(function (err) {
                    logger.error(err);
                    next(err);
                });
        });

        app.get('/' + HOOK_ID + '/:ownerId/:projectName/result/:commitHash', function (req, res, next) {
            var collection = db.collection(req.params.ownerId + '+' + req.params.projectName);
            collection.findOne({_id: '#' + req.params.commitHash})
                .then(function (result) {
                    if (result) {
                        res.json(result);
                    } else {
                        res.sendStatus(404);
                    }
                })
                .catch(function (err) {
                    logger.error(err);
                    next(err);
                });
        });

        app.get('/' + HOOK_ID + '/status', function (req, res) {
            res.json(results);
        });

        server = app.listen(options.port);
        serverUrl = 'http://127.0.0.1:' + options.port;
        logger.info('Webhook listening at:', serverUrl);
        logger.info('Connecting to mongodb at:' + options.mongoUri);

        mongodb.MongoClient.connect(options.mongoUri, hookConfig.mongoOptions)
            .then(function (db_) {
                db = db_;
                global.db = db;
                deferred.resolve({
                    db: db,
                    server: server
                });
            })
            .catch(deferred.reject);

        return deferred.promise.nodeify(callback);
    };

    this.stop = function (callback) {
        var deferred = Q.defer();
        // Shutdown server and disconnect from mongodb.
        if (server) {
            server.close();
            server = null;
        }

        if (db) {
            db.close(function () {
                db = null;
                deferred.resolve();
            });
        } else {
            deferred.resolve();
        }

        global.db = null;

        return deferred.promise.nodeify(callback);
    };

    this.getUrl = function () {
        return serverUrl;
    };
}

module.exports = Handler;
