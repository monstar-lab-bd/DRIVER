(function () {
    'use strict';

    /**
     * Handles the interaction for CSV exports and custom report generation.
     * Uses filter query parameters provided by MapController.
     *
     * For CSV exports - makes a request to start an export job then polls
     * for the result and provides the link.
     *
     * For custom reports - displays a modal to configure the report then
     * opens up the report in a new window.
     */

    /* ngInject */
    function ExportController($interval, $modal, $rootScope, $scope,
                              Exports, InitialState, QueryBuilder) {
        var ctl = this;
        var pollingInterval;
        var POLLING_INTERVAL_MS = 1500;
        var MAX_POLLING_TIME_S = 100;

        InitialState.ready().then(initialize);

        function initialize() {
            ctl.isOpen = false;
            ctl.pending = false;
            ctl.downloadURL = null;
            ctl.error = null;

            ctl.toggle = toggle;
            ctl.exportCSV = exportCSV;
            ctl.showCustomReportsModal = showCustomReportsModal;
        }

        function toggle() {
            ctl.isOpen = !ctl.isOpen;
            if (ctl.isOpen) {
                $rootScope.$broadcast('driver.export.open');
            }
        }

        function exportCSV() {
            cancelPolling();
            ctl.error = null;
            ctl.downloadURL = null;

            var params = _.extend({ tilekey: true, limit: 0 }, ctl.recordQueryParams);
            // Get a tilekey then trigger an export
            QueryBuilder.djangoQuery(0, params).then(function(records) {
                Exports.create({ tilekey: records.tilekey },
                    function (result) {pollForDownload(result.taskid); },
                    function () { ctl.error = 'Error initializing export.'; }
                );
            });
        }

        function pollForDownload(taskID) {
            ctl.pending = true;
            pollingInterval = $interval(function () {
                    Exports.get({ id: taskID }).$promise.then(function (response) {
                        switch (response.status) {
                            case 'PENDING':
                            case 'STARTED':
                                break;
                            case 'FAILURE':
                                ctl.error = response.error;
                                cancelPolling();
                                break;
                            case 'SUCCESS':
                                ctl.downloadURL = response.result;
                                cancelPolling();
                                break;
                        }
                    });
                },
                POLLING_INTERVAL_MS,
                MAX_POLLING_TIME_S * 1000 / POLLING_INTERVAL_MS
            );
            // The interval's promise resolves if it hits the limit without being cancelled
            pollingInterval.then(function () {
                cancelPolling();
                ctl.error = 'Export request timed out.';
            });
        }

        function cancelPolling() {
            ctl.pending = false;
            $interval.cancel(pollingInterval);
        }

        // Shows the custom reports modal
        function showCustomReportsModal() {
            $modal.open({
                templateUrl: 'scripts/custom-reports/custom-reports-modal-partial.html',
                controller: 'CustomReportsModalController as modal'
            });
        }

        $scope.$on('driver.charts.open', function () { ctl.isOpen = false; });
        $scope.$on('$destroy', cancelPolling);
    }

    angular.module('driver.export')
    .controller('ExportController', ExportController);

})();
