import { describe, expect, it } from 'vitest';

import { BzSummaryStats, BzTaskStats } from '../src/bzStats.js';
import type { FlatTaskListEntry, StatsSnapshot, TaskRunStats } from '../src/index.js';

function snapshot(time: number): StatsSnapshot {
  return {
    time,
    memory: { rss: time + 1, heapTotal: time + 2, heapUsed: time + 3 }
  };
}

function run(time: number): TaskRunStats {
  return {
    start: snapshot(0),
    end: snapshot(time),
    diff: { time, memory: { rss: 1, heapTotal: 2, heapUsed: 3 } }
  };
}

describe('task statistics', () => {
  it('records task runs and supports current and parent summaries', () => {
    const stats = new BzTaskStats();
    stats.start();
    const id = stats.startTask();
    stats.endTask(id);
    stats.endTask(999);
    stats.end();

    expect(stats.getTask(id)?.diff).toHaveProperty('time');
    expect(stats.getTask(999)).toBeUndefined();
    expect(stats.getCurrentDiffStats()).toHaveProperty('memory.rss');
    expect(stats.getCurrentDiffStats(id).time).toBeGreaterThanOrEqual(0);
    expect(stats.getCurrentDiffStats(999).time).toBeGreaterThanOrEqual(0);
    expect(stats.getRuns()).toHaveLength(1);

    const ownSummary = stats.getSummary();
    expect(ownSummary.tasksRuns).toHaveLength(1);

    const parent = { tasksRuns: [run(5)], diff: run(5).diff as never };
    const summary = stats.getSummary(parent);
    expect(summary.tasksRuns).toHaveLength(2);
    expect(summary.diff).toBe(parent.diff);
  });

  it('falls back to a fresh snapshot when stored start data is incomplete', () => {
    const stats = new BzTaskStats();
    (stats as unknown as { _start: Partial<StatsSnapshot> })._start = {};

    expect(stats.getCurrentDiffStats()).toHaveProperty('memory.heapTotal');
  });

  it('calculates aggregate timing and per-sample statistics', () => {
    const stats = new BzSummaryStats();
    const list = [
      {
        name: 'Tasks',
        tasks: {},
        stats: { getRuns: () => [run(4), run(6), run(15)] }
      },
      { name: 'NoStats', tasks: {}, stats: {} }
    ] as FlatTaskListEntry[];

    stats.add(list);

    expect(stats.getTotalTasks()).toBe(3);
    expect(stats.getTimeStats()).toEqual({ total: 25, avg: 25 / 3, min: 4, max: 15 });
    expect(stats.getPerTaskStats()).toEqual({ time: [4, 6, 15] });
    expect(stats.getPerTimeStats(10)).toEqual({ tasks: [2, 0, 1] });
  });

  it('keeps empty aggregate statistics stable', () => {
    const stats = new BzSummaryStats();
    stats.add([]);

    expect(stats.getTotalTasks()).toBe(0);
    expect(stats.getTimeStats()).toEqual({
      total: 0,
      avg: 0,
      min: Number.MAX_SAFE_INTEGER,
      max: 0
    });
    expect(stats.getPerTaskStats()).toEqual({ time: [] });
    expect(stats.getPerTimeStats(10)).toEqual({ tasks: [] });
  });

  it('uses zero when aggregate runs do not contain a time difference', () => {
    const stats = new BzSummaryStats();
    stats.add([
      {
        name: 'MissingDiff',
        tasks: {},
        stats: { getRuns: () => [{ start: {}, end: {}, diff: {} }] }
      }
    ] as FlatTaskListEntry[]);

    expect(stats.getTimeStats()).toEqual({ total: 0, avg: 0, min: 0, max: 0 });
    expect(stats.getPerTaskStats()).toEqual({ time: [0] });
    expect(stats.getPerTimeStats(10)).toEqual({ tasks: [] });
  });
});
