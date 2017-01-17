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
    hookConfig = componentJson.ConstraintCheckerHook ||
        require(path.join('..', '..', '..', 'config', 'components.json')).ConstraintCheckerHook,
    HOOK_ID = hookConfig.id,
    logger = webgme.Logger.create('gme:' + HOOK_ID, gmeConfig.bin.log, false);


webgme.addToRequireJsPaths(gmeConfig);

/**
 * @param {string} [options.port] - Port hook handler should listen too (gmeConfig.server.port + 1).
 * @constructor
 */
function Handler(options) {
    var app = new Express(),
        db,
        results = [],
        server;

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
                if (pluginResult.success === true) {
                    logger.debug(JSON.stringify(pluginResult, null, 2));
                    logger.debug('SUCCEEDED!');
                } else if (pluginResult.error) {
                    logger.error(JSON.stringify(pluginResult, null, 2));
                    logger.error('FAILED!');
                } else {
                    
                }
            })
            .catch(function (err) {
                result.exception = err.stack;
                logger.error('EXCEPTION:', err);
            });
    }

    this.start = function (callback) {
        var deferred = Q.defer();

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
                    res.json(result);
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
        logger.info('Webhook listening at:  http://127.0.0.1:' + options.port);
        logger.info('Connecting to mongodb at:' + options.mongoUri);

        mongodb.MongoClient.connect(options.mongoUri, hookConfig.mongoOptions)
            .then(function (db_) {
                db = db_;
                global.db = db;
                deferred.resolve();
            })
            .catch(deferred.reject);

        return deferred.promise.nodeify(callback);
    };

    this.stop = function (callback) {
        server.close();
        callback();
    };
}

module.exports = Handler;

if (require.main === module) {
    var Command = require('commander').Command,
        program = new Command(),
        handler;

    program
        .version('1.0.0')
        .description('Starts a webhook handler server that evaluates the constraints using ConstraintChecker plugin. ' +
            'The cwd should be the root directory of the webgme domain repo and the gmeConfig used can be altered using ' +
            'the environment variable NODE_ENV.')
        .option('-p, --port [number]', 'Port the webhook-handler should listen at ' +
            '[' + hookConfig.port + ']', hookConfig.port)
        .option('-u, --mongoUri [string]', 'Mongodb URI where data is persisted ' +
            '[' + hookConfig.mongoUri + ']', hookConfig.mongoUri)
        .on('--help', function () {
            var i,
                env = process.env.NODE_ENV || 'default';

            console.log('  Examples:');
            console.log();
            console.log('    $ node constraintChecker.js');
            console.log('    $ node constraintChecker.js -p 8080');
            console.log();
            console.log('  Plugin paths using ' + configDir + path.sep + 'config.' + env + '.js :');
            console.log();
            for (i = 0; i < gmeConfig.plugin.basePaths.length; i += 1) {
                console.log('    "' + gmeConfig.plugin.basePaths[i] + '"');
            }
        })
        .parse(process.argv);

    if (gmeConfig.webhooks.enable !== true) {
        logger.error('gmeConfig.webhooks.enable must be true in order to dispatch events from the webgme server!');
        program.help();
    } else {
        handler = new Handler(program);

        handler.start(function (err) {
            if (err) {
                logger.error(err);
                process.exit(1);
            } else {
                logger.info('Webhook is listening at ' + program.port);
            }
        });

        process.on('SIGINT', function () {
            handler.stop(function (err) {
                if (err) {
                    logger.error(err);
                    process.exit(1);
                } else {
                    process.exit(0);
                }
            });
        });
    }
}
