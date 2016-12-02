"use strict";

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * ========================================================
 * Beelzebub Stats Class
 * ========================================================
 */
var BzStats = function () {
    function BzStats() {
        (0, _classCallCheck3.default)(this, BzStats);
    }

    (0, _createClass3.default)(BzStats, [{
        key: "getRunTasksCount",
        value: function getRunTasksCount() {}
    }, {
        key: "getTotalRunTime",
        value: function getTotalRunTime() {}
    }, {
        key: "getCurrentDiffStats",
        value: function getCurrentDiffStats() {
            var endStats = util.getStats();
            var startStats = this._stats.start;
            // default to now if time doesn't exist
            if (!startStats.time) {
                startStats = util.getStats();
            }

            return util.calcStatsDiff(startStats, endStats);
        }
    }, {
        key: "getStats",
        value: function getStats() {
            var time = process.hrtime();
            time = time[0] * 1e3 + time[1] / 1e6;

            return {
                time: time,
                memory: process.memoryUsage()
            };
        }
    }, {
        key: "calcStatsDiff",
        value: function calcStatsDiff(start, end) {
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
    return BzStats;
}();

module.exports = BzStats;