module.exports = {
  'api': {
    'helloworld':       {},
    'async':            {},
    'parallel':         {},
    'sequence':         {},
    'extend':           {},
    'stream':           {},
    'gulp':             {},
    'defaultRootlevel': {},
    'subtasksSimple':   {},
    'subtasksAdvanced': {},
    'passingVars':      {},
    'decorator':        {},
    'kitchenSink':      {}
  },
  'cli': {
    'helloworld': { 'type': 'cli', 'args': ['MyTasks.task1', 'MyTasks.task2'] },
    'decorator':  { 'type': 'cli', 'args': ['--help'] }
  }
};
