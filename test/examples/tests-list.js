module.exports = {
  'api': {
    'helloworld':        {},
    'async':             {},
    'parallel':          {},
    'sequence':          {},
    'extend':            {},
    'stream':            {},
    'gulp':              {},
    'default_rootlevel': {},
    'subtasks_simple':   {},
    'subtasks_advanced': {},
    'decorator':         {},
    'kitcken_sink':      {}
  },
  'cli': {
    'helloworld': { 'type': 'cli', 'args': ['MyTasks.task1', 'MyTasks.task2'] },
    'decorator':  { 'type': 'cli', 'args': ['--help'] }
  }
};
