<!-- # Beelzebub - One hell of a task master! -->
<center id="top"><img src="./assets/bz-logo-full.png" /></center>


[![Build Status](https://secure.travis-ci.org/jstty/beelzebub.png?branch=master)](http://travis-ci.org/jstty/beelzebub)
[![Coverage Status](https://coveralls.io/repos/github/jstty/beelzebub/badge.svg?branch=master)](https://coveralls.io/github/jstty/beelzebub?branch=master)
![License](https://img.shields.io/npm/l/beelzebub.svg)
[![Dependency Status](https://david-dm.org/jstty/beelzebub.png?theme=shields.io&branch=master)](https://david-dm.org/jstty/beelzebub)
[![devDependency Status](https://david-dm.org/jstty/beelzebub/dev-status.png?theme=shields.io&branch=master)](https://david-dm.org/jstty/beelzebub#info=devDependencies)

<center>
<div><a target="_blank" href="https://nodei.co/npm/beelzebub/"><img src="https://nodei.co/npm/beelzebub.png" /></a>
</div>
<div>
<a target="_blank" href="http://twitter.com/beelzebubio"><img width="32px" src="assets/twitter-logo.svg" /></a>
</div>
</center>

## Description
A modern task runner pipeline framework.
Allows your Tasks to be Modular, Extendable, Flexible, Manageable, and Fire Resistant!

## Features
1. Tasks are based on Promises, support: 
    * Generator  ([Example](./examples/api/async.js))
        * Using [co wrapping](https://github.com/tj/co)
    * Async/Await ([Example](./examples/api/async.js))
    * Streams ([Example](./examples/api/stream.js))
        * Compatible with your existing `gulp` tasks
2. ES6 Class base class
    * Extending from other Tasks ([Example](./examples/api/extend.js))
3. Sub Tasks
    * Static - simply by adding another task class to a tasks sub class. ([Example](./examples/api/subtasksSimple.js))
    * Dynamic - create sub tasks based on configuration ([Example](./examples/api/subtasksAdvanced.js))
4. Run other tasks in an task
    * Parallel ([Example](./examples/api/parallel.js))
    * Sequence ([Example](./examples/api/sequence.js))
5. Before and After ([Simple Example](./examples/api/beforeAfter.js), [Adv Example](./examples/api/beforeAfterAdvanced.js))
    * each task
    * all tasks
6. Decorators
    * Setting Default Task ([Example](./examples/api/decoratorHelp.js))
    * Help Docs ([Example](./examples/api/decoratorHelp.js))
    * Vars Definitions (for help and set defaults) ([Example](./examples/api/decoratorVars.js))
7. Auto Help Docs ([ALI Example](./examples/api/helpDocs.js), [CLI Example](./examples/cli/helpDocs.js))
8. Passing Options (Vars) to a task or globally ([ALI Example](./examples/api/passingVars.js), [CLI Example](./examples/cli/defineVars.js))
9. CLI ([Examples](./examples/cli)) and full Javascript API ([Examples](./examples/api))
10. **Totally bad *ss logo!**

-------
# Install

## API
```shell
$ npm install beelzebub
```

## CLI
```shell
$ npm install beelzebub -g
```

-------
# DOCS
### [Task Class](./docs/taskClass.md)

-------
# API
### [Examples](./examples/api)

# Simple Example
```javascript
const Beelzebub = require('beelzebub');

class MyTasks extends Beelzebub.Tasks {
    task1() {
        this.logger.log('MyTasks task1');
    }
}

// Add Task to BZ, it will now be registered
Beelzebub.add( MyTasks );

// ------------------------------------
// Runs the task, returning a promise
Beelzebub.run('MyTasks.task1');
```

-------
# CLI
### [Examples](./examples/cli)

## Reserved Global Flags
* `--help` or `-h`
    * Prints Usage, List of Task Help Docs and Vars Definitions
* `--version` or `-v`
    * Prints Beelzebub version
* `--file=<file path>` or `-f=<file path>`
    * Uses this file instead of the `beelzebub.js` or `beelzebub.json` file

<!--
# File Loader
TODO 
-->

## Passing Vars
The CLI uses [yargs](https://github.com/yargs/yargs) and thus the vars parsing is handled by [yargs-parser](https://github.com/yargs/yargs-parser).

```shell
$ bz <global vars> TaskPath <vars to pass to this Task> AnotherTaskPath <vars will only pass to the preceding Task> 
```

--------
## Simple Example
### `beelzebub.js` file
```javascript
const Beelzebub = require('beelzebub');

class MyTasks extends Beelzebub.Tasks {
    task() {
        this.logger.log('MyTasks task');
    }
}

module.exports = MyTasks;
```

```shell
$ bz MyTasks.task
```


--------
## Vars Example

### `beelzebub.js` file
```javascript
const Beelzebub = require('beelzebub');

class MyTasks1 extends Beelzebub.Tasks {
    default(aVars) {
        const gVars = this.$getGlobalVars();
        this.logger.log(`MyTasks1 default ${gVars.myGlobalVar} ${aVars.v1}`);
    }
}

class MyTasks2 extends Beelzebub.Tasks {
    task(aVars) {
        const gVars = this.$getGlobalVars();
        this.logger.log(`MyTasks1 task ${gVars.myGlobalVar} ${aVars.v1}`);
    }
}

module.exports = [MyTasks1, MyTasks2];
```

```shell
$ bz --myGlobalVar=hello MyTasks1 --v1=1 MyTasks2.task --v1=2
```

--------
## Load File Example

### `appTasks.js` file
```javascript
module.exports = [
  require('bz-frontend-react'),
  require('bz-frontend-babel'),
  require('./mytask.js')
];
```

```shell
$ bz --file=./appTasks.js MyTasks.task1
```

--------
## Special Thanks
To everyone supporting the development and cost to the project.
I would also like to thank the logo artist [Irving Gerardo](https://thenounproject.com/irvinggerardo)!!!

--------
## License
It should be an obvious choice or you totally missed the [badge at the top](#top).

However for completeness;

*"I Beelzebub, declare myself to be under the [MIT licence](LICENSE)"*
