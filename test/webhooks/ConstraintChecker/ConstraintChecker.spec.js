/*globals*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */
/*jshint node:true, mocha:true*/
describe('WebHook', function() {
    var testFixture = require('../../globals'),
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        gmeConfig = testFixture.getGmeConfig(),
        server = testFixture.WebGME.standaloneServer(gmeConfig),
        mntPt = require('../../../webgme-setup.json').components.routers['ConstraintResults'].mount,
        HookHandler = require('../../../src/webhooks/ConstraintChecker/ConstraintChecker'),
        hookHandler,
        gmeAuth,
        urlFor = function(action) {
            return [
                hookHandler.getUrl(),
                global.constraintCheckerHookConfig.id,
                action
            ].join('/');
        };

    before(function(done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                return testFixture.clearAndGetHookResultDB(
                    global.constraintCheckerHookConfig.mongoUri,
                    global.constraintCheckerHookConfig.mongoOptions);
            })
            .then(function () {
                done();
            })
            .catch(done);
    });

    after(function(done) {
        done();
        //server.stop(done);
    });

    beforeEach(function (done) {
        hookHandler = new HookHandler({
            port: global.constraintCheckerHookConfig.port,
            mongoUri: global.constraintCheckerHookConfig.mongoUri
        });

        hookHandler.start(done);
    });

    afterEach(function (done) {
        hookHandler.stop(done);
    });

    it('should return empty array at /%HOOK_ID%/status when nothing ran', function (done) {
        superagent.get(urlFor('status'))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.deep.equal([]);
                done();
            });
    });

    ///%HOOK_ID%/:ownerId/:projectName/status/:commitHash
    it('should return exists:false status for non-existing project', function (done) {
        superagent.get(urlFor('guest/doesNotExist/status/1a040796c8ce0a957ba152d1f94d9ec453667acf'))
            .end(function(err, res) {
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

    ///%HOOK_ID%/:ownerId/:projectName/result/:commitHash
    it('should return 404 result for non-existing project', function (done) {
        superagent.get(urlFor('guest/doesNotExist/result/1a040796c8ce0a957ba152d1f94d9ec453667acf'))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(404);
                done();
            });
    });
});
