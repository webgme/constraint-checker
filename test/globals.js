// This is used by the test/plugins tests
/*globals requireJS*/
/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var testFixture = require('webgme/test/_globals'),
    mongodb = require('mongodb'),
    WEBGME_CONFIG_PATH = '../config';

// This flag will make sure the config.test.js is being used
// process.env.NODE_ENV = 'test'; // This is set by the require above, overwrite it here.

var WebGME = testFixture.WebGME,
    gmeConfig = require(WEBGME_CONFIG_PATH),
    getGmeConfig = function getGmeConfig() {
    'use strict';
    // makes sure that for each request it returns with a unique object and tests will not interfere
    if (!gmeConfig) {
        // if some tests are deleting or unloading the config
        gmeConfig = require(WEBGME_CONFIG_PATH);
    }
    return JSON.parse(JSON.stringify(gmeConfig));
};

WebGME.addToRequireJsPaths(gmeConfig);

testFixture.getGmeConfig = getGmeConfig;

// FIXME: bug in 2.9.0 version
testFixture.projectName2Id = function (projectName, userId) {
    return testFixture.storageUtil.getProjectIdFromOwnerIdAndProjectName(userId, projectName);
};

testFixture.clearAndGetHookResultDB = function (uri, options, keepAlive) {
    var db;
    return mongodb.MongoClient.connect(uri, options)
        .then(function (db_) {
            db = db_;

            return db.dropDatabase();
        })
        .then(function () {
            if (keepAlive) {
                return db;
            } else {
                return db.close();
            }
        });
};

global.constraintCheckerHookConfig = {
    "id": "ConstraintCheckerHook",
    "origin": "http://127.0.0.1",
    "port": 9002,
    "description": "Checks if there are any meta violations in the project",
    "events": [
        "COMMIT"
    ],
    "addAtProjectCreation": true,
    "activeAtProjectCreation": true,
    "maximumConcurrentJobs": 1,
    "mongoUri": "mongodb://127.0.0.1:27017/webgme_constraint_results_tests",
    "mongoOptions": {}
};

module.exports = testFixture;