/*globals define, _, WebGMEGlobal*/
/*jshint browser: true*/
/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Thu Jan 12 2017 15:15:42 GMT-0600 (Central Standard Time).
 */

define(['superagent'], function (superagent) {
    'use strict';

    var routeURL = WebGMEGlobal.gmeConfig.rest.components.ConstraintResults.mount;

    function getStatus(projectId, commitHash, callback) {
        var project = projectId.split('+');

        superagent.get(routeURL + '/' + project[0] + '/' + project[1] + '/status/' + commitHash.slice(1))
            .end(function (err, result) {
                callback(err, result ? result.body : {});
            });
    }

    function getResult(projectId, commitHash, callback) {
        var project = projectId.split('+');

        superagent.get(routeURL + '/' + project[0] + '/' + project[1] + '/result/' + commitHash.slice(1))
            .end(function (err, result) {
                callback(err, result ? result.body : {});
            });
    }

    return {
        getStatus: getStatus,
        getResult: getResult
    };
});
