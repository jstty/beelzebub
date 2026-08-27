import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      '$before event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      '$before ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      'MyTasks task1',
      'customEvent event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}',
      'customEvent ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}',
      '$after event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      '$after ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      '$before ALL event task: {"task":"MyTasks.task2","vars":{}} , data: ',
      'MyTasks task2',
      'customEvent ALL event task: {"task":"MyTasks.task2","vars":{}} , data: {"hello":"world2"}',
      '$after ALL event task: {"task":"MyTasks.task2","vars":{}} , data: '
    ])
];
export default tests;
