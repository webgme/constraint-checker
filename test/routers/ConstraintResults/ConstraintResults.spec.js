/*jshint node:true, mocha:true*/
describe('ConstraintResults router', function() {
    var testFixture = require('../../globals'),
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        gmeConfig = testFixture.getGmeConfig(),
        server = testFixture.WebGME.standaloneServer(gmeConfig),
        mntPt = require('../../../webgme-setup.json').components.routers['ConstraintResults'].mount,
        webHookHandler = require('../../../src/webhooks/ConstraintChecker/ConstraintChecker'),
        gmeAuth,
        urlFor = function(action) {
            return [
                server.getUrl(),
                mntPt,
                action
            ].join('/');
        };

    before(function(done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                server.start(done);
            })
            .catch(done)
    });

    after(function(done) {
        server.stop(done);
    });

    it('should add hook at creation', function(done) {
        superagent.put(server.getUrl(), '/api/projects/guest/shouldgethook')
            .send({
                type: 'file',
                seedName: 'EmptyProject'
            })
            .end(function(err, res) {
                expect(res.statusCode).to.equal(201);
                done();
            });
    });
});
