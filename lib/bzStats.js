'use strict';

const _ = require('lodash');

/**
 * ========================================================
 * Beelzebub Stats Class
 * ========================================================
 */
class BzTaskStats {

    constructor () {
        this._runs = [];
        this._tasksStats = {};

        this._start = this._getStats();
        this._end = null;
    }

    start () {
        this._start = this._getStats();
    }

    end () {
        this._end = this._getStats();
    }

    startTask () {
        let stats = {
            start: {},
            end:   {},
            diff:  {}
        };
        stats.start = this._getStats();
        this._runs.push(stats);

        return this._runs.length - 1;
    }

    endTask (statsIndex) {
        this._runs[statsIndex].end = this._getStats();
        this._runs[statsIndex].diff = this._calcStatsDiff(this._runs[statsIndex].start, this._runs[statsIndex].end);
    }

    getTask (statsId) {
        return this._runs[statsId];
    }

    getSummary (parentSummary) {
        let summary = {
            tasksRuns: this._runs,
            diff:  this.getCurrentDiffStats()
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
    getCurrentDiffStats (statsId) {
        const endStats = this._getStats();

        // if not statsId passed in then must be root
        let startStats = this._start;
        if (statsId) {
            startStats = this._runs[statsId];
        }

        // default to now if time doesn't exist
        if (!startStats.time) {
            startStats = this._getStats();
        }

        return this._calcStatsDiff(startStats, endStats);
    }

    getRuns () {
        return this._runs;
    }

    _getStats () {
        let time = process.hrtime();
        time = time[0] * 1e3 + time[1] / 1e6;

        return {
            time:   time,
            memory: process.memoryUsage()
        };
    }

    _calcStatsDiff (start, end) {
        let memory = {
            heapTotal: 0,
            heapUsed:  0,
            rss:       0
        };

        if (end.memory && start.memory) {
            memory.heapTotal = end.memory.heapTotal - start.memory.heapTotal;
            memory.heapUsed = end.memory.heapUsed - start.memory.heapUsed;
            memory.rss = end.memory.rss - start.memory.rss;
        }

        return {
            time:   end.time - start.time,
            memory: memory
        };
    }
}

class BzSummaryStats {
    constructor () {
        this._runs = [];
        this._time = {
            total: 0,
            avg: 0,
            min: Number.MAX_SAFE_INTEGER,
            max: 0
        };
    }

    add (list) {
        let listRuns = _.reduce(list, (result, task) => {
            result = result.concat(task.stats.getRuns());
            return result;
        }, []);

        this._runs = this._runs.concat(listRuns);

        this._calcTimes();
    }

    _calcTimes () {
        _.forEach(this._runs, (run) => {
            this._time.total += run.diff.time;

            if (run.diff.time > this._time.max) {
                this._time.max = run.diff.time; 
            }
            if (run.diff.time < this._time.min) {
                this._time.min = run.diff.time;    
            }
        });

        if (this._runs.length > 0) {
            this._time.avg = this._time.total/this._runs.length;
        }
    }

    getTimeStats () {
        return this._time;
    }

    getTotalTasks () {
        return this._runs.length;
    }

    getPerTaskStats () {
        let stats = {
            time: []
        };

        _.forEach(this._runs, (run) => {
            stats.time.push(run.diff.time);
        });

        return stats;
    }

    getPerTimeStats (sampleRate) {
        let count = Math.ceil(this._time.total / sampleRate);
        let stats = {
            tasks: []
        };

        let lower = 0;
        let upper = sampleRate;
        for (let i = 0; i < count; i++) {
            stats.tasks[i] = 0;
            let cTime = 0;
            for (let j = 0; j < this._runs.length; j++) {
                let run = this._runs[j];
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
}

module.exports = {
    Task:    BzTaskStats,
    Summary: BzSummaryStats
};
