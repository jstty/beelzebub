import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(
      app,
      [
        '┌────────────────────────────────────────────────────────────────────────────────┐\n│ Help Docs                                                                      │\n└────────────────────────────────────────────────────────────────────────────────┘',
        '┌────────────────────────────────────────────────────────────────────────────────┐\n│ MyTasks                                                                        │\n└────────────────────────────────────────────────────────────────────────────────┘',
        'task1',
        '\t ES7 Decorator Example MyTasks - Task 1 \n',
        'task2',
        '\t ES7 Decorator Example MyTasks - Task 2 \n',
        '┌────────────────────────────────────────────────────────────────────────────────┐\n│ MyTasks2                                                                       │\n└────────────────────────────────────────────────────────────────────────────────┘',
        'task1',
        '\t ES7 Decorator Example MyTasks2 - Task 1 \n',
        'task2',
        '\t ES7 Decorator Example MyTasks2 - Task 2 \n'
      ],
      'helpLogger'
    )
];
export default tests;
