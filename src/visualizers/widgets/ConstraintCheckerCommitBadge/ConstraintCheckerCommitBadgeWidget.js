/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Thu Jan 12 2017 15:15:42 GMT-0600 (Central Standard Time).
 */

define([
    'panels/ConstraintCheckerCommitBadge/ConstraintCheckerController',
    'js/Dialogs/ConstraintCheckResults/ConstraintCheckResultsDialog',
    'css!./styles/ConstraintCheckerCommitBadgeWidget.css'
], function (ConstraintCheckerController, ConstraintCheckResultsDialog) {
    'use strict';

    var STATUS_TIMEOUT_LENGTH = 5000;

    function ConstraintCheckerCommitBadgeWidget(containerEl, client, params) {
        var self = this;
        this._client = client;
        this._commitHash = params.id;
        this._timeoutId = null;

        this._destroyed = false;
        this.$el = $('<i>', {
            class: 'constraint-checker-commit-badge loading'
        });

        $(containerEl).append(this.$el);

        this._updateStatus();
    }

    ConstraintCheckerCommitBadgeWidget.prototype._updateStatus = function () {
        var self = this;
        ConstraintCheckerController.getStatus(this._client.getActiveProjectId(), this._commitHash, function (err, status) {
            if (self._destroyed) {
                return;
            }

            self.$el.removeClass('loading is-running fa fa-circle');

            if (err) {
                self.$el.addClass('error fa fa-exclamation');
                self.$el.attr('title', 'Error');
            } else if (status.exists === false) {
                self.$el.addClass('unavailable fa fa-circle-thin');
                self.$el.attr('title', 'Results unavailable');
            } else if (status.isQueued === true) {
                self.$el.addClass('is-running fa fa-circle');
                self.$el.attr('title', 'Job is queued...');
                self._timeoutId = setTimeout(function () {
                    self._updateStatus();
                }, STATUS_TIMEOUT_LENGTH);
            } else if (status.isRunning === true) {
                self.$el.addClass('is-running fa fa-circle');
                self.$el.attr('title', 'Meta constraints are being checked...');
                self._timeoutId = setTimeout(function () {
                    self._updateStatus();
                }, STATUS_TIMEOUT_LENGTH);
            } else if (status.metaInconsistent === true) {
                self.$el.addClass('meta-inconsistent fa fa-times');
                self.$el.attr('title', 'The meta is inconsistent!');
                // TODO: Show the violations..
            } else if (status.hasViolation === true) {
                self.$el.addClass('has-violation fa fa-times');
                self.$el.attr('title', 'View meta constraint violations');
                self.$el.on('click', function () {
                    ConstraintCheckerController.getResult(self._client.getActiveProjectId(), self._commitHash,
                        function (err, result) {
                            if (err) {
                                console.log(err);
                            } else {
                                self._showConstraintCheckDialog(result.result);
                            }
                        });
                });
            } else if (status.hasViolation === false) {
                self.$el.addClass('no-violation fa fa-check');
                self.$el.attr('title', 'No meta constraint violations');
            } else {
                self.$el.addClass('unavailable fa fa-circle-thin');
                self.$el.attr('title', 'Results unavailable');
            }
        });
    };

    ConstraintCheckerCommitBadgeWidget.prototype._showConstraintCheckDialog = function (result) {
        result.__unread = true;
        (new ConstraintCheckResultsDialog('Meta Rules Validation Results')).show(this._client, [result]);
    };

    ConstraintCheckerCommitBadgeWidget.prototype.destroy = function () {
        this.$el.off('click');
        clearTimeout(this._timeoutId);
        this._destroyed = true;
    };

    return ConstraintCheckerCommitBadgeWidget;
});
