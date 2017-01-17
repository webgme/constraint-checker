/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Plugin for checking and inserting result in database. This plugin should be used together with the constraintChecker
 * webhook and constraintChecker router in this repo.
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'common/core/users/constraintchecker',
    'common/core/users/metarules'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    CC,
    metarules) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ConstraintChecker.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ConstraintChecker.
     * @constructor
     */
    var ConstraintChecker = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ConstraintChecker.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ConstraintChecker.prototype = Object.create(PluginBase.prototype);
    ConstraintChecker.prototype.constructor = ConstraintChecker;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(null|Error, plugin.PluginResult)} callback - the result callback
     */
    ConstraintChecker.prototype.main = function (callback) {
        var self = this,
            config = this.getCurrentConfig(),
            db = global.db,
            checker = new CC.Checker(this.core, this.logger),
            coll;

        checker.initialize(this.rootNode, this.commitHash, config.constraintType);

        // TODO: Check meta consistency
        if (typeof db === 'undefined') {
            callback(new Error('Cannot run without db'), self.result);
        }

        coll = db.collection(self.project.projectId);

        coll.updateOne({_id: self.commitHash}, {_id: self.commitHash, isRunning: true}, {upsert: true})
            .then(function () {
                var inconsistencies = metarules.checkMetaConsistency(self.core, self.rootNode);
                if (inconsistencies.length > 0) {
                    return inconsistencies;
                } else {
                    return checker.checkModel('');
                }
            })
            .then(function (result) {
                var key,
                    data = {
                        _id: self.commitHash,
                        isRunning: false,
                        metaInconsistent: false,
                        hasViolation: false,
                        result: null
                    };

                if (result instanceof Array) {
                    data.metaInconsistent = true;
                    data.result = result;
                } else if (result.hasViolation === false) {
                    data.result = {
                        commit: result.commit,
                        info: result.info,
                        hasViolation: false
                    };

                    self.result.setSuccess(true);
                } else {
                    // FIXME: The constraint checker in webgme should not return all these results...
                    for (key in result) {
                        if (typeof result[key] === 'object' && result[key] !== null && result[key].hasViolation === false) {
                            delete result[key];
                        }
                    }

                    self.logger.info(JSON.stringify(result, null, 2));
                    data.hasViolation = true;
                    data.result = result;
                }

                return coll.updateOne({_id: self.commitHash}, data, {upsert: true});
            })
            .then(function () {
                callback(null, self.result);
            })
            .catch(function (err) {
                self.logger.error(err.stack);
                callback(err, self.result);
            });
    };

    return ConstraintChecker;
});
