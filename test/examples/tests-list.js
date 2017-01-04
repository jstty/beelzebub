module.exports = {
  'api': {
    'helloworld':          {},
    'async':               {},
    'parallel':            {},
    'sequence':            {},
    'extend':              {},
    'stream':              {},
    'gulp':                {},
    'defaultRootlevel':    {},
    'subtasksSimple':      {},
    'subtasksAdvanced':    {},
    'passingVars':         {},
    'beforeAfter':         {},
    'beforeAfterAdvanced': {},
    'helpDocs':            {},
    'defineVars':          {},
    'decoratorHelp':       {},
    'decoratorVars':       {},
    'events':              {},
    'kitchenSink':         {}
  },
  'cli': {
    'helloworld': { 'type': 'cli', 'args': ['MyTasks.task1', 'MyTasks.task2'] },
    'helpDocs':   { 'type': 'cli', 'args': ['--help'] },
    'defineVars': { 'type': 'cli',
      'args': [
        'MyTasks.task1',
        'MyTasks.task2', '--count=100', '-v',
        'MyTasks.task3', '--fullname.first=hello', '--fullname.last=world', '--list=te', '--list=st'
      ] },
    'decoratorHelp': { 'type': 'cli', 'args': ['--help'] },
    'decoratorVars': { 'type': 'cli',
      'args': [
        'MyTasks.task1',
        'MyTasks.task2', '--count=100', '-v',
        'MyTasks.task3', '--fullname.first=hello', '--fullname.last=world', '--list=te', '--list=st'
      ] }
  }
};
