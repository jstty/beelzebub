import type { FlatTaskListEntry, StatsDiff, StatsSnapshot, TaskRunStats } from './types.js';
import { calcStatsDiff, getStats } from './util.js';

/** Per-task-class execution stats. */
export class BzTaskStats {
  private _runs: TaskRunStats[] = [];
  private _start: StatsSnapshot = getStats();
  private _end: StatsSnapshot | null = null;

  start(): void {
    this._start = getStats();
  }

  end(): void {
    this._end = getStats();
  }

  startTask(): number {
    const stats: TaskRunStats = { start: getStats(), end: {}, diff: {} };
    this._runs.push(stats);
    return this._runs.length - 1;
  }

  endTask(statsIndex: number): void {
    const run = this._runs[statsIndex];
    if (!run) return;
    run.end = getStats();
    run.diff = calcStatsDiff(run.start as StatsSnapshot, run.end as StatsSnapshot);
  }

  getTask(statsId: number): TaskRunStats | undefined {
    return this._runs[statsId];
  }

  getSummary(parentSummary?: { tasksRuns: TaskRunStats[]; diff: StatsDiff }): {
    tasksRuns: TaskRunStats[];
    diff: StatsDiff;
  } {
    const summary = {
      tasksRuns: this._runs,
      diff: this.getCurrentDiffStats()
    };

    if (parentSummary) {
      // Preserve legacy behavior (concat runs, prefer parent diff)
      summary.tasksRuns = parentSummary.tasksRuns.concat(this._runs);
      summary.diff = parentSummary.diff;
    }

    return summary;
  }

  /** Diff between `start` (or a specific run) and now. */
  getCurrentDiffStats(statsId?: number): StatsDiff {
    const endStats = getStats();

    let startStats: StatsSnapshot = this._start;
    if (statsId !== undefined) {
      const run = this._runs[statsId];
      if (run && (run.start as StatsSnapshot).time !== undefined) {
        startStats = run.start as StatsSnapshot;
      }
    }

    if (!startStats || (startStats as StatsSnapshot).time === undefined) {
      startStats = getStats();
    }

    return calcStatsDiff(startStats, endStats);
  }

  getRuns(): TaskRunStats[] {
    return this._runs;
  }
}

interface TimeStats {
  total: number;
  avg: number;
  min: number;
  max: number;
}

export class BzSummaryStats {
  private _runs: TaskRunStats[] = [];
  private _time: TimeStats = {
    total: 0,
    avg: 0,
    min: Number.MAX_SAFE_INTEGER,
    max: 0
  };

  add(list: FlatTaskListEntry[]): void {
    const listRuns: TaskRunStats[] = [];
    for (const task of list) {
      const stats = task.stats as { getRuns?: () => TaskRunStats[] } | undefined;
      if (stats && typeof stats.getRuns === 'function') {
        listRuns.push(...stats.getRuns());
      }
    }
    this._runs = this._runs.concat(listRuns);
    this._calcTimes();
  }

  private _calcTimes(): void {
    for (const run of this._runs) {
      const t = (run.diff as StatsDiff).time ?? 0;
      this._time.total += t;
      if (t > this._time.max) this._time.max = t;
      if (t < this._time.min) this._time.min = t;
    }

    if (this._runs.length > 0) {
      this._time.avg = this._time.total / this._runs.length;
    }
  }

  getTimeStats(): TimeStats {
    return this._time;
  }

  getTotalTasks(): number {
    return this._runs.length;
  }

  getPerTaskStats(): { time: number[] } {
    return { time: this._runs.map((r) => (r.diff as StatsDiff).time ?? 0) };
  }

  getPerTimeStats(sampleRate: number): { tasks: number[] } {
    const count = Math.ceil(this._time.total / sampleRate);
    const tasks: number[] = [];

    let lower = 0;
    let upper = sampleRate;
    for (let i = 0; i < count; i++) {
      tasks[i] = 0;
      let cTime = 0;
      for (const run of this._runs) {
        cTime += (run.diff as StatsDiff).time ?? 0;
        if (cTime > lower && cTime <= upper) {
          tasks[i]!++;
        }
      }
      lower = upper;
      upper += sampleRate;
    }

    return { tasks };
  }
}

export const Task = BzTaskStats;
export const Summary = BzSummaryStats;
