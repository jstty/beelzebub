'use strict';

var _maxSafeInteger = require('babel-runtime/core-js/number/max-safe-integer');

var _maxSafeInteger2 = _interopRequireDefault(_maxSafeInteger);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash');

/**
 * ========================================================
 * Beelzebub Stats Class
 * ========================================================
 */

var BzTaskStats = function () {
    function BzTaskStats() {
        (0, _classCallCheck3.default)(this, BzTaskStats);

        this._runs = [];
        this._tasksStats = {};

        this._start = this._getStats();
        this._end = null;
    }

    (0, _createClass3.default)(BzTaskStats, [{
        key: 'start',
        value: function start() {
            this._start = this._getStats();
        }
    }, {
        key: 'end',
        value: function end() {
            this._end = this._getStats();
        }
    }, {
        key: 'startTask',
        value: function startTask() {
            var stats = {
                start: {},
                end: {},
                diff: {}
            };
            stats.start = this._getStats();
            this._runs.push(stats);

            return this._runs.length - 1;
        }
    }, {
        key: 'endTask',
        value: function endTask(statsIndex) {
            this._runs[statsIndex].end = this._getStats();
            this._runs[statsIndex].diff = this._calcStatsDiff(this._runs[statsIndex].start, this._runs[statsIndex].end);
        }
    }, {
        key: 'getTask',
        value: function getTask(statsId) {
            return this._runs[statsId];
        }
    }, {
        key: 'getSummary',
        value: function getSummary(parentSummary) {
            var summary = {
                tasksRuns: this._runs,
                diff: this.getCurrentDiffStats()
            };

            if (parentSummary) {
                summary.tasksRuns += parentSummary.tasksRuns;
                summary.diff = parentSummary.diff;
            }

            return summary;
        }

        /**
         * @input statsId (optional), if not set then root
         */

    }, {
        key: 'getCurrentDiffStats',
        value: function getCurrentDiffStats(statsId) {
            var endStats = this._getStats();

            // if not statsId passed in then must be root
            var startStats = this._start;
            if (statsId) {
                startStats = this._runs[statsId];
            }

            // default to now if time doesn't exist
            if (!startStats.time) {
                startStats = this._getStats();
            }

            return this._calcStatsDiff(startStats, endStats);
        }
    }, {
        key: 'getRuns',
        value: function getRuns() {
            return this._runs;
        }
    }, {
        key: '_getStats',
        value: function _getStats() {
            var time = process.hrtime();
            time = time[0] * 1e3 + time[1] / 1e6;

            return {
                time: time,
                memory: process.memoryUsage()
            };
        }
    }, {
        key: '_calcStatsDiff',
        value: function _calcStatsDiff(start, end) {
            var memory = {
                heapTotal: 0,
                heapUsed: 0,
                rss: 0
            };

            if (end.memory && start.memory) {
                memory.heapTotal = end.memory.heapTotal - start.memory.heapTotal;
                memory.heapUsed = end.memory.heapUsed - start.memory.heapUsed;
                memory.rss = end.memory.rss - start.memory.rss;
            }

            return {
                time: end.time - start.time,
                memory: memory
            };
        }
    }]);
    return BzTaskStats;
}();

var BzSummaryStats = function () {
    function BzSummaryStats() {
        (0, _classCallCheck3.default)(this, BzSummaryStats);

        this._runs = [];
        this._time = {
            total: 0,
            avg: 0,
            min: _maxSafeInteger2.default,
            max: 0
        };
    }

    (0, _createClass3.default)(BzSummaryStats, [{
        key: 'add',
        value: function add(list) {
            var listRuns = _.reduce(list, function (result, task) {
                result = result.concat(task.stats.getRuns());
                return result;
            }, []);

            this._runs = this._runs.concat(listRuns);

            this._calcTimes();
        }
    }, {
        key: '_calcTimes',
        value: function _calcTimes() {
            var _this = this;

            _.forEach(this._runs, function (run) {
                _this._time.total += run.diff.time;

                if (run.diff.time > _this._time.max) {
                    _this._time.max = run.diff.time;
                }
                if (run.diff.time < _this._time.min) {
                    _this._time.min = run.diff.time;
                }
            });

            if (this._runs.length > 0) {
                this._time.avg = this._time.total / this._runs.length;
            }
        }
    }, {
        key: 'getTimeStats',
        value: function getTimeStats() {
            return this._time;
        }
    }, {
        key: 'getTotalTasks',
        value: function getTotalTasks() {
            return this._runs.length;
        }
    }, {
        key: 'getPerTaskStats',
        value: function getPerTaskStats() {
            var stats = {
                time: []
            };

            _.forEach(this._runs, function (run) {
                stats.time.push(run.diff.time);
            });

            return stats;
        }
    }, {
        key: 'getPerTimeStats',
        value: function getPerTimeStats(sampleRate) {
            var count = Math.ceil(this._time.total / sampleRate);
            var stats = {
                tasks: []
            };

            var lower = 0;
            var upper = sampleRate;
            for (var i = 0; i < count; i++) {
                stats.tasks[i] = 0;
                var cTime = 0;
                for (var j = 0; j < this._runs.length; j++) {
                    var run = this._runs[j];
                    cTime += run.diff.time;

                    if (cTime > lower && cTime <= upper) {
                        stats.tasks[i]++;
                    }
                }
                lower = upper;
                upper += sampleRate;
            }

            return stats;
        }
    }]);
    return BzSummaryStats;
}();

module.exports = {
    Task: BzTaskStats,
    Summary: BzSummaryStats
};