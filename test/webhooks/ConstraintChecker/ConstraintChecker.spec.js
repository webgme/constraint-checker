/*globals*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */
/*jshint node:true, mocha:true*/
describe('ConstraintChecker WebHook', function () {
    var testFixture = require('../../globals'),
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        gmeConfig = testFixture.getGmeConfig(),
        server = testFixture.WebGME.standaloneServer(gmeConfig),
        mntPt = require('../../../webgme-setup.json').components.routers['ConstraintResults'].mount,
        HookHandler = require('../../../src/webhooks/ConstraintChecker/ConstraintChecker'),
        importResult,
        storage,
        hookHandler,
        hookRes,
        gmeAuth,
        projectName = 'fromEmptyProject',
        urlFor = function (action) {
            action = action instanceof Array ? action.join('/') : action;
            return [
                hookHandler.getUrl(),
                global.constraintCheckerHookConfig.id,
                action
            ].join('/');
        };

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return testFixture.clearAndGetHookResultDB(
                    global.constraintCheckerHookConfig.mongoUri,
                    global.constraintCheckerHookConfig.mongoOptions);
            })
            .then(function () {
                storage = testFixture.getMongoStorage(testFixture.logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: testFixture.path.join(testFixture.SEED_DIR, 'EmptyProject.webgmex'),
                    projectName: projectName,
                    branchName: 'master',
                    logger: testFixture.logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult_) {
                importResult = importResult_;
                done();
            })
            .catch(done);
    });

    after(function (done) {
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    beforeEach(function (done) {
        hookHandler = new HookHandler({
            port: global.constraintCheckerHookConfig.port,
            mongoUri: global.constraintCheckerHookConfig.mongoUri
        });

        hookHandler.start()
            .then(function (res) {
                hookRes = res;
            })
            .nodeify(done);
    });

    afterEach(function (done) {
        hookHandler.stop(done);
    });

    it('should return empty array at /%HOOK_ID%/status when nothing ran', function (done) {
        superagent.get(urlFor('status'))
            .end(function (err, res) {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.deep.equal([]);
                done();
            });
    });

    ///%HOOK_ID%/:ownerId/:projectName/status/:commitHash
    it('should return exists:false status for non-existing project', function (done) {
        superagent.get(urlFor('guest/doesNotExist/status/1a040796c8ce0a957ba152d1f94d9ec453667acf'))
            .end(function (err, res) {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.deep.equal({
                    exists: false,
                    hasViolation: false,
                    isRunning: false,
                    metaInconsistent: false
                });
                done();
            });
    });

    it('should return exists:true status for existing project', function (done) {
        var ownerId = 'guest',
            projectName = 'hasResult',
            projectId = testFixture.projectName2Id(projectName, ownerId),
            commit = '2a040796c8ce0a957ba152d1f94d9ec453667acf',
            data = {
                _id: '#' + commit,
                isRunning: false,
                metaInconsistent: false,
                hasViolation: false,
                result: {
                    commit: '#' + commit,
                    info: 'Hello there',
                    hasViolation: false
                }
            },
            coll = hookRes.db.collection(projectId);

        coll.updateOne({_id: '#' + commit}, data, {upsert: true})
            .then(function () {
                superagent.get(urlFor([ownerId, projectName, 'status', commit]))
                    .end(function (err, res) {
                        expect(res.statusCode).to.equal(200);
                        expect(res.body).to.deep.equal({
                            exists: true,
                            hasViolation: false,
                            isRunning: false,
                            metaInconsistent: false
                        });
                        done();
                    });
            });
    });

    ///%HOOK_ID%/:ownerId/:projectName/result/:commitHash
    it('should return 404 result for non-existing project', function (done) {
        superagent.get(urlFor('guest/doesNotExist/result/1a040796c8ce0a957ba152d1f94d9ec453667acf'))
            .end(function (err, res) {
                expect(res.statusCode).to.equal(404);
                done();
            });
    });

    it('should return full-data result for existing project', function (done) {
        var ownerId = 'guest',
            projectName = 'hasResult',
            projectId = testFixture.projectName2Id(projectName, ownerId),
            commit = '3a040796c8ce0a957ba152d1f94d9ec453667acf',
            data = {
                _id: '#' + commit,
                isRunning: false,
                metaInconsistent: false,
                hasViolation: false,
                result: {
                    commit: '#' + commit,
                    info: 'Hello there',
                    hasViolation: false
                }
            },
            coll = hookRes.db.collection(projectId);

        coll.updateOne({_id: '#' + commit}, data, {upsert: true})
            .then(function () {
                superagent.get(urlFor([ownerId, projectName, 'status', commit]))
                    .end(function (err, res) {
                        expect(res.statusCode).to.equal(200);
                        expect(res.body).to.deep.equal({
                            exists: true,
                            hasViolation: false,
                            isRunning: false,
                            metaInconsistent: false
                        });
                        done();
                    });
            });
    });

    ///post %HOOK_ID%/:ownerId/:projectName/result/:commitHash
    it('should run plugin when posting payload and eventually return status', function (done) {
        var payload = {
                event: 'COMMIT',
                projectId: importResult.project.projectId,
                owner: 'guest',
                projectName: projectName,
                hookId: global.constraintCheckerHookConfig.id,
                data: {
                    projectId: importResult.project.projectId,
                    commitHash: importResult.commitHash,
                    userId: 'guest'
                }
            },
            url = [hookHandler.getUrl(), global.constraintCheckerHookConfig.id].join('/');

        superagent.post(url)
            .send(payload)
            .end(function (err, res) {
                expect(res.statusCode).to.equal(200);
                var cnt = 0,
                    intervalId = setInterval(function () {
                        cnt += 1;
                        if (cnt > 10) {
                            clearInterval(intervalId);
                            done(new Error('Timeout!'));
                            return;
                        }

                        superagent.get(urlFor(['guest',
                            projectName,
                            'status',
                            importResult.commitHash.slice(1, importResult.commitHash.length)]))
                            .end(function (err, res) {
                                if (err) {
                                    clearInterval(intervalId);
                                    done(err);
                                    return;
                                }

                                if (res.body.exists === false) {
                                    // Plugin hasn't started.
                                } else if (res.body.exists === true) {
                                    // Plugin has started, finished?
                                    if (res.body.isRunning === false) {
                                        clearInterval(intervalId);

                                        expect(res.body).to.deep.equal({
                                            exists: true,
                                            hasViolation: false,
                                            isRunning: false,
                                            metaInconsistent: false
                                        });

                                        done();
                                    }
                                }
                            });
                    }, 100);
            });
    });
});
