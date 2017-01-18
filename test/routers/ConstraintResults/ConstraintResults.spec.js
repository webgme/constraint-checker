/*jshint node:true, mocha:true*/
describe('ConstraintResults Router', function() {
    var testFixture = require('../../globals'),
        superagent = testFixture.superagent,
        expect = testFixture.expect,
        gmeConfig = testFixture.getGmeConfig(),
        server = testFixture.WebGME.standaloneServer(gmeConfig),
        mntPt = require('../../../webgme-setup.json').components.routers['ConstraintResults'].mount,
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

    it.skip('should add hook at creation', function(done) {
        superagent.put(server.getUrl(), '/api/projects/guest/ShouldHaveHook')
            .send({
                type: 'file',
                seedName: 'EmptyProject'
            })
            .end(function(err, res) {
                expect(res.statusCode).to.equal(204);
                done();
            });
    });

    it('should return 403 if no project access', function(done) {
        superagent.get(urlFor('guest/doesNotExist/status/1a040796c8ce0a957ba152d1f94d9ec453667acf'))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(403);
                done();
            });
    });

    it.skip('should return 200 for webhookStatus', function(done) {
        superagent.get(urlFor('webhookStatus'))
            .end(function(err, res) {
                expect(res.statusCode).to.equal(403);
                done();
            });
    });
});
