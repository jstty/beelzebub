import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyBaseTasks task1',
      'MyTasks task1',
      '------------------------------',
      'SuperTasks comboTask',
      'SuperTasks task1: 1',
      'SuperTasks task1: 2',
      '------------------------------',
      'SuperTasks palTask',
      'SuperTasks task1: 1',
      'SuperTasks task2: 1',
      'SuperTasks task1: 2',
      'SuperTasks task2: 2',
      '------------------------------',
      'SuperTasks task2: 1',
      'SuperTasks task2: 2'
    ])
];
export default tests;
