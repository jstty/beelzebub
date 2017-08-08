# beelzebub - Task Class (v1.0.3)

<!-- div class="toc-container" -->

<!-- div -->

## `Methods`
* <a href="#$addSubTasks">`$addSubTasks`</a>
* <a href="#$afterAll">`$afterAll`</a>
* <a href="#$afterEach">`$afterEach`</a>
* <a href="#$beforeAll">`$beforeAll`</a>
* <a href="#$beforeEach">`$beforeEach`</a>
* <a href="#$config">`$config`</a>
* <a href="#$defineTaskVars">`$defineTaskVars`</a>
* <a href="#$getGlobalVars">`$getGlobalVars`</a>
* <a href="#$getName">`$getName`</a>
* <a href="#$getRunning">`$getRunning`</a>
* <a href="#$getStatsSummary">`$getStatsSummary`</a>
* <a href="#$getSubTask">`$getSubTask`</a>
* <a href="#$getSubTasks">`$getSubTasks`</a>
* <a href="#$getTask">`$getTask`</a>
* <a href="#$getTaskFlatList">`$getTaskFlatList`</a>
* <a href="#$getTaskTree">`$getTaskTree`</a>
* <a href="#$getVarDefsForTaskName">`$getVarDefsForTaskName`</a>
* <a href="#$hasRunBefore">`$hasRunBefore`</a>
* <a href="#$hasSubTask">`$hasSubTask`</a>
* <a href="#$hasTask">`$hasTask`</a>
* <a href="#$init">`$init`</a>
* <a href="#$isRoot">`$isRoot`</a>
* <a href="#$parallel">`$parallel`</a>
* <a href="#$printHelp">`$printHelp`</a>
* <a href="#$register">`$register`</a>
* <a href="#$run">`$run`</a>
* <a href="#$sequence">`$sequence`</a>
* <a href="#$setDefault">`$setDefault`</a>
* <a href="#$setGlobalVars">`$setGlobalVars`</a>
* <a href="#$setName">`$setName`</a>
* <a href="#$setSubTask">`$setSubTask`</a>
* <a href="#$setSubTasks">`$setSubTasks`</a>
* <a href="#$setTaskHelpDocs">`$setTaskHelpDocs`</a>
* <a href="#$useAsRoot">`$useAsRoot`</a>

<!-- /div -->

<!-- /div -->

<!-- div class="doc-container" -->

<!-- div -->

## `Methods`

<!-- div -->

<h3 id="$addSubTasks"><a href="#$addSubTasks">#</a>&nbsp;<code>$addSubTasks(Task, [config={}])</code></h3>
[&#x24C8;](../lib/bzTasks.js#L515 "View in source") [&#x24C9;][1]

Add Sub Tasks

#### Arguments
1. `Task` *(object)*: Task Class
2. `[config={}]` *(object)*: Config for Task

#### Returns
*(object)*: Promise

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyBaseTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName(config.name || 'MyBaseTasks');

      this.value = config.value;
      this._delayTime = 300;
    }

    $init () {
      return this._delay('MyBaseTasks init');
    }

    _delay (message) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, this._delayTime);
      });
    }

    task1 () {
      return this._delay('MyBaseTasks task1 - ' + this.value);
    }
  }

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
    }

    $init () {
      this.logger.log('MyTasks init');
      // simlate tasks dynamiclly added after some async event
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks1', value: 123 });
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks2', value: 456 });
          // done
          resolve(1234);
        }, 200);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence('MyTasks.MyBaseTasks1.task1', 'MyTasks.MyBaseTasks2.task1');
    }
  }

  bz.add(MyTasks);
  let p = bz.run('MyTasks.task1');
/* Output:
MyTasks init
MyBaseTasks init
MyBaseTasks init
MyTasks task1
MyBaseTasks task1 - 123
MyBaseTasks task1 - 456
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$afterAll"><a href="#$afterAll">#</a>&nbsp;<code>$afterAll()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L368 "View in source") [&#x24C9;][1]

This should to be Extented

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MySubBaseTasks1 extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MySubBaseTasks1 init');
    }

    // generator function
    * $beforeAll (taskInfo) {
      yield this._delay(`MySubBaseTasks1 beforeAll - ${taskInfo.task}`);
    }

    // generator function
    * $afterAll () {
      return this._delay('MySubBaseTasks1 afterAll');
    }

    // generator function
    * $beforeEach (taskInfo) {
      return this._delay(`MySubBaseTasks1 beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MySubBaseTasks1 afterEach - ${taskInfo.task}`);
    }

    taskA1 () {
      return this._delay('MySubBaseTasks1 taskA1');
    }
  }

  class MySubBaseTasks2 extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MySubBaseTasks2 init');
    }

    // generator function
    * $beforeAll (taskInfo) {
      yield this._delay(`MySubBaseTasks2 beforeAll - ${taskInfo.task}`);
    }

    // generator function
    * $afterAll () {
      return this._delay('MySubBaseTasks2 afterAll');
    }

    // generator function
    * $beforeEach (taskInfo) {
      return this._delay(`MySubBaseTasks2 beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MySubBaseTasks2 afterEach - ${taskInfo.task}`);
    }

    taskA2 () {
      return this._delay('MySubBaseTasks2 taskA2');
    }
  }

  class MyBaseTasks extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MyBaseTasks init');
      // see subtasksSimple or Advanced for details on adding sub tasks
      this.$addSubTasks(MySubBaseTasks1);
    }

    // returns promise
    $beforeAll (taskInfo) {
      return this._delay(`MyBaseTasks beforeAll - ${taskInfo.task}`).then(() => {
        return this.$addSubTasks(MySubBaseTasks2);
      });
    }

    // returns promise
    $afterAll () {
      return this._delay('MyBaseTasks afterAll');
    }

    // returns promise
    $beforeEach (taskInfo) {
      return this._delay(`MyBaseTasks beforeEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`);
    }

    // returns promise
    $afterEach (taskInfo) {
      return this._delay(`MyBaseTasks afterEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`);
    }

    taskA (vars) {
      return this._delay(`MyBaseTasks taskA - ${vars.hello}`);
    }

    taskB (vars) {
      return this._delay('MyBaseTasks taskB');
    }
  }

  class MyTasks extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MyTasks init');
      // see subtasksSimple or Advanced for details on adding sub tasks
      this.$addSubTasks(MyBaseTasks);
    }

    // generator function
    * $beforeEach (taskInfo) {
      yield this._delay(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MyTasks afterEach - ${taskInfo.task}`);
    }

    // generator function
    * $beforeAll (taskInfo) {
      yield this._delay(`MyTasks beforeAll - ${taskInfo.task}`);
    }

    // generator function
    * $afterAll () {
      yield this._delay(`MyTasks afterAll`);
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence({
        task: '.MyBaseTasks.taskA',
        vars: { hello: 'world' }
      },
      '.MyBaseTasks.taskB',
      '.MyBaseTasks.MySubBaseTasks2.taskA2');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyTasks);

  let p = bz.run('MyTasks.MyBaseTasks.MySubBaseTasks1.taskA1', 'MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks init
MyBaseTasks init
MySubBaseTasks1 init
MyTasks beforeAll - taskA1
MyBaseTasks beforeAll - taskA1
MySubBaseTasks2 init
MySubBaseTasks1 beforeAll - taskA1
MySubBaseTasks1 beforeEach - taskA1
MySubBaseTasks1 taskA1
MySubBaseTasks1 afterEach - taskA1
MyTasks beforeEach - task1
MyTasks task1
MyBaseTasks beforeEach - taskA {"hello":"world"}
MyBaseTasks taskA - world
MyBaseTasks afterEach - taskA {"hello":"world"}
MyBaseTasks beforeEach - taskB {}
MyBaseTasks taskB
MyBaseTasks afterEach - taskB {}
MySubBaseTasks2 beforeAll - taskA2
MySubBaseTasks2 beforeEach - taskA2
MySubBaseTasks2 taskA2
MySubBaseTasks2 afterEach - taskA2
MyTasks afterEach - task1
MyTasks beforeEach - task2
MyTasks task2
MyTasks afterEach - task2
MySubBaseTasks1 afterAll
MySubBaseTasks2 afterAll
MyBaseTasks afterAll
MyTasks afterAll
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$afterEach"><a href="#$afterEach">#</a>&nbsp;<code>$afterEach(taskInfo)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L351 "View in source") [&#x24C9;][1]

This should to be Extented

#### Arguments
1. `taskInfo` *(object)*: {name, vars}

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    $beforeEach (taskInfo) {
      this.logger.log(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    $afterEach (taskInfo) {
      this.logger.log(`MyTasks afterEach - ${taskInfo.task}`);
    }

    $beforeAll () {
      this.logger.log(`MyTasks beforeAll`);
    }

    $afterAll () {
      this.logger.log(`MyTasks afterAll`);
    }

    // my tasks
    task1 () {
      this.logger.log('MyTasks task1');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }
  }

  bz.add(MyTasks);

  let p = bz.run('MyTasks.task1', 'MyTasks.task2');

/* Output:
MyTasks beforeAll
MyTasks beforeEach - task1
MyTasks task1
MyTasks afterEach - task1
MyTasks beforeEach - task2
MyTasks task2
MyTasks afterEach - task2
MyTasks afterAll
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$beforeAll"><a href="#$beforeAll">#</a>&nbsp;<code>$beforeAll(taskInfo)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L360 "View in source") [&#x24C9;][1]

This should to be Extented

#### Arguments
1. `taskInfo` *(object)*: {name, vars}

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MySubBaseTasks1 extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MySubBaseTasks1 init');
    }

    // generator function
    * $beforeAll (taskInfo) {
      yield this._delay(`MySubBaseTasks1 beforeAll - ${taskInfo.task}`);
    }

    // generator function
    * $afterAll () {
      return this._delay('MySubBaseTasks1 afterAll');
    }

    // generator function
    * $beforeEach (taskInfo) {
      return this._delay(`MySubBaseTasks1 beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MySubBaseTasks1 afterEach - ${taskInfo.task}`);
    }

    taskA1 () {
      return this._delay('MySubBaseTasks1 taskA1');
    }
  }

  class MySubBaseTasks2 extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MySubBaseTasks2 init');
    }

    // generator function
    * $beforeAll (taskInfo) {
      yield this._delay(`MySubBaseTasks2 beforeAll - ${taskInfo.task}`);
    }

    // generator function
    * $afterAll () {
      return this._delay('MySubBaseTasks2 afterAll');
    }

    // generator function
    * $beforeEach (taskInfo) {
      return this._delay(`MySubBaseTasks2 beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MySubBaseTasks2 afterEach - ${taskInfo.task}`);
    }

    taskA2 () {
      return this._delay('MySubBaseTasks2 taskA2');
    }
  }

  class MyBaseTasks extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MyBaseTasks init');
      // see subtasksSimple or Advanced for details on adding sub tasks
      this.$addSubTasks(MySubBaseTasks1);
    }

    // returns promise
    $beforeAll (taskInfo) {
      return this._delay(`MyBaseTasks beforeAll - ${taskInfo.task}`).then(() => {
        return this.$addSubTasks(MySubBaseTasks2);
      });
    }

    // returns promise
    $afterAll () {
      return this._delay('MyBaseTasks afterAll');
    }

    // returns promise
    $beforeEach (taskInfo) {
      return this._delay(`MyBaseTasks beforeEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`);
    }

    // returns promise
    $afterEach (taskInfo) {
      return this._delay(`MyBaseTasks afterEach - ${taskInfo.task} ${JSON.stringify(taskInfo.vars)}`);
    }

    taskA (vars) {
      return this._delay(`MyBaseTasks taskA - ${vars.hello}`);
    }

    taskB (vars) {
      return this._delay('MyBaseTasks taskB');
    }
  }

  class MyTasks extends Beelzebub.Tasks {
    _delay (message, delay = 100) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    $init () {
      this.logger.log('MyTasks init');
      // see subtasksSimple or Advanced for details on adding sub tasks
      this.$addSubTasks(MyBaseTasks);
    }

    // generator function
    * $beforeEach (taskInfo) {
      yield this._delay(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    // generator function
    * $afterEach (taskInfo) {
      yield this._delay(`MyTasks afterEach - ${taskInfo.task}`);
    }

    // generator function
    * $beforeAll (taskInfo) {
      yield this._delay(`MyTasks beforeAll - ${taskInfo.task}`);
    }

    // generator function
    * $afterAll () {
      yield this._delay(`MyTasks afterAll`);
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence({
        task: '.MyBaseTasks.taskA',
        vars: { hello: 'world' }
      },
      '.MyBaseTasks.taskB',
      '.MyBaseTasks.MySubBaseTasks2.taskA2');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }

    _internalFunction () {
      this.logger.error('this should be ignored');
    }
  }
  bz.add(MyTasks);

  let p = bz.run('MyTasks.MyBaseTasks.MySubBaseTasks1.taskA1', 'MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks init
MyBaseTasks init
MySubBaseTasks1 init
MyTasks beforeAll - taskA1
MyBaseTasks beforeAll - taskA1
MySubBaseTasks2 init
MySubBaseTasks1 beforeAll - taskA1
MySubBaseTasks1 beforeEach - taskA1
MySubBaseTasks1 taskA1
MySubBaseTasks1 afterEach - taskA1
MyTasks beforeEach - task1
MyTasks task1
MyBaseTasks beforeEach - taskA {"hello":"world"}
MyBaseTasks taskA - world
MyBaseTasks afterEach - taskA {"hello":"world"}
MyBaseTasks beforeEach - taskB {}
MyBaseTasks taskB
MyBaseTasks afterEach - taskB {}
MySubBaseTasks2 beforeAll - taskA2
MySubBaseTasks2 beforeEach - taskA2
MySubBaseTasks2 taskA2
MySubBaseTasks2 afterEach - taskA2
MyTasks afterEach - task1
MyTasks beforeEach - task2
MyTasks task2
MyTasks afterEach - task2
MySubBaseTasks1 afterAll
MySubBaseTasks2 afterAll
MyBaseTasks afterAll
MyTasks afterAll
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$beforeEach"><a href="#$beforeEach">#</a>&nbsp;<code>$beforeEach(taskInfo)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L342 "View in source") [&#x24C9;][1]

This should to be Extented

#### Arguments
1. `taskInfo` *(object)*: {name, vars}

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    $beforeEach (taskInfo) {
      this.logger.log(`MyTasks beforeEach - ${taskInfo.task}`);
    }

    $afterEach (taskInfo) {
      this.logger.log(`MyTasks afterEach - ${taskInfo.task}`);
    }

    $beforeAll () {
      this.logger.log(`MyTasks beforeAll`);
    }

    $afterAll () {
      this.logger.log(`MyTasks afterAll`);
    }

    // my tasks
    task1 () {
      this.logger.log('MyTasks task1');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }
  }

  bz.add(MyTasks);

  let p = bz.run('MyTasks.task1', 'MyTasks.task2');

/* Output:
MyTasks beforeAll
MyTasks beforeEach - task1
MyTasks task1
MyTasks afterEach - task1
MyTasks beforeEach - task2
MyTasks task2
MyTasks afterEach - task2
MyTasks afterAll
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$config"><a href="#$config">#</a>&nbsp;<code>$config()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L147 "View in source") [&#x24C9;][1]

Gets Current Config

#### Returns
*(object)*: config

---

<!-- /div -->

<!-- div -->

<h3 id="$defineTaskVars"><a href="#$defineTaskVars">#</a>&nbsp;<code>$defineTaskVars(taskName, taskDef)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L279 "View in source") [&#x24C9;][1]

Define Task Vars

#### Arguments
1. `taskName` *(string)*: Name of Task
2. `taskDef` *(object)*: Var Defintion for Task

#### Example
```js
  const Beelzebub = require('../../');
  const bz = Beelzebub(options || { verbose: true });
  const task = Beelzebub.TmplStrFunc.task;

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$defineTaskVars('task1', {
        name: { type: 'String', default: 'hello' },
        flag: { type: 'Boolean', default: true }
      });
      this.$defineTaskVars('task2', {
        count:   { type: 'Number', required: true },
        verbose: { type: 'Boolean', alias: 'v', default: false }
      });
      this.$defineTaskVars('task3', {
        fullname: {
          type:       'Object',
          properties: {
            first: { type: 'String' },
            last:  { type: 'String' }
          }
        },
        list: {
          type:  'Array',
          items: { type: 'String' }
        }
      });
    }

    task1 (customVars) {
      this.logger.log(`MyTasks task1 - ${JSON.stringify(this.$getGlobalVars())} ${customVars.name} ${customVars.flag}`);
    }

    task2 (customVars) {
      this.logger.log(`MyTasks task2 - ${customVars.count} ${customVars.verbose}`);
    }

    task3 (customVars) {
      this.logger.log(`MyTasks task3 - "${customVars.fullname.first} ${customVars.fullname.last}" ${customVars.list}`);
    }
  }

  bz.add(MyTasks);

  let p = bz.run(
    'MyTasks.task1',
    task`MyTasks.task2:${{count: 100, verbose: true}}`,
    {
      task: 'MyTasks.task3',
      vars: {
        fullname: { first: 'hello', last: 'world' },
        list:     [ 'te', 'st' ]
      }
    }
  );
/* Output:
MyTasks task1 - {} hello true
MyTasks task2 - 100 true
MyTasks task3 - "hello world" te,st
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$getGlobalVars"><a href="#$getGlobalVars">#</a>&nbsp;<code>$getGlobalVars()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L269 "View in source") [&#x24C9;][1]

Get Global Vars

#### Returns
*(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getName"><a href="#$getName">#</a>&nbsp;<code>$getName()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L197 "View in source") [&#x24C9;][1]

Get name of Task Group/Class

#### Returns
*(string)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getRunning"><a href="#$getRunning">#</a>&nbsp;<code>$getRunning()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L376 "View in source") [&#x24C9;][1]

Is Task Running?

#### Returns
*(boolean)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getStatsSummary"><a href="#$getStatsSummary">#</a>&nbsp;<code>$getStatsSummary()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L114 "View in source") [&#x24C9;][1]

Get task status and all it's sub tasks stats

#### Returns
*(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getSubTask"><a href="#$getSubTask">#</a>&nbsp;<code>$getSubTask(name)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L223 "View in source") [&#x24C9;][1]

Get SubTask by Name

#### Arguments
1. `name` *(string)*: Name of Sub Task

#### Returns
*(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getSubTasks"><a href="#$getSubTasks">#</a>&nbsp;<code>$getSubTasks()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L247 "View in source") [&#x24C9;][1]

Get All Sub Task(s)

#### Returns
*(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getTask"><a href="#$getTask">#</a>&nbsp;<code>$getTask(name)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L206 "View in source") [&#x24C9;][1]

Get Task by Name

#### Arguments
1. `name` *(string)*: Name of Task to get

#### Returns
*(function)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getTaskFlatList"><a href="#$getTaskFlatList">#</a>&nbsp;<code>$getTaskFlatList()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L93 "View in source") [&#x24C9;][1]

Get flatten task tree so it's one level

#### Returns
*(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getTaskTree"><a href="#$getTaskTree">#</a>&nbsp;<code>$getTaskTree()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L60 "View in source") [&#x24C9;][1]

Get Task Tree starting with this task

#### Returns
*(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$getVarDefsForTaskName"><a href="#$getVarDefsForTaskName">#</a>&nbsp;<code>$getVarDefsForTaskName(taskStr)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L306 "View in source") [&#x24C9;][1]

Get Define Task Vars by Name

#### Arguments
1. `taskStr` *(string)*: Name of Task

#### Returns
*(object)*: Varaible Definition for Task

---

<!-- /div -->

<!-- div -->

<h3 id="$hasRunBefore"><a href="#$hasRunBefore">#</a>&nbsp;<code>$hasRunBefore()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L173 "View in source") [&#x24C9;][1]

Has any of the tasks ran before?

#### Returns
*(boolean)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$hasSubTask"><a href="#$hasSubTask">#</a>&nbsp;<code>$hasSubTask(name)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L239 "View in source") [&#x24C9;][1]

Does this have a Sub Task with the name?

#### Arguments
1. `name` *(string)*: Name of Sub Task

#### Returns
*(boolean)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$hasTask"><a href="#$hasTask">#</a>&nbsp;<code>$hasTask(name)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L214 "View in source") [&#x24C9;][1]

Does this Task Group have a Task with the name?

#### Arguments
1. `name` *(string)*: Name of Task

#### Returns
*(boolean)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$init"><a href="#$init">#</a>&nbsp;<code>$init()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L333 "View in source") [&#x24C9;][1]

This should be Extented

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyBaseTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName(config.name || 'MyBaseTasks');

      this.value = config.value;
      this._delayTime = 300;
    }

    $init () {
      return this._delay('MyBaseTasks init');
    }

    _delay (message) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, this._delayTime);
      });
    }

    task1 () {
      return this._delay('MyBaseTasks task1 - ' + this.value);
    }
  }

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
    }

    $init () {
      this.logger.log('MyTasks init');
      // simlate tasks dynamiclly added after some async event
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks1', value: 123 });
          this.$addSubTasks(MyBaseTasks, { name: 'MyBaseTasks2', value: 456 });
          // done
          resolve(1234);
        }, 200);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence('MyTasks.MyBaseTasks1.task1', 'MyTasks.MyBaseTasks2.task1');
    }
  }

  bz.add(MyTasks);
  let p = bz.run('MyTasks.task1');
/* Output:
MyTasks init
MyBaseTasks init
MyBaseTasks init
MyTasks task1
MyBaseTasks task1 - 123
MyBaseTasks task1 - 456
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$isRoot"><a href="#$isRoot">#</a>&nbsp;<code>$isRoot()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L181 "View in source") [&#x24C9;][1]

Is this task root level?

#### Returns
*(boolean)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$parallel"><a href="#$parallel">#</a>&nbsp;<code>$parallel(args)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L651 "View in source") [&#x24C9;][1]

Runs task(s) in parallel

#### Arguments
1. `args` *(function|string): task(s)*

#### Returns
*(object)*: Promise

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    _delay (message, delay = 300) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$parallel('.task3', '.task4');
    }

    task2 () {
      return this._delay('MyTasks task2', 200);
    }

    task3 () {
      this.logger.log('MyTasks task3');
      return this.$run(['.task5', '.task6']);
    }

    task4 () {
      return this._delay('MyTasks task4', 400);
    }

    task5 () {
      this.logger.log('MyTasks task5');
    }

    task6 () {
      return this._delay('MyTasks task6', 600);
    }
}

  bz.add(MyTasks);
  // arrays are run in parallel
  let p = bz.run(['MyTasks.task1', 'MyTasks.task2']);
/* Output:
MyTasks task1
MyTasks task3
MyTasks task5
MyTasks task2
MyTasks task4
MyTasks task6
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$printHelp"><a href="#$printHelp">#</a>&nbsp;<code>$printHelp()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L128 "View in source") [&#x24C9;][1]

Prints Task help and all sub tasks help

#### Example
```js
  const Beelzebub = require('../../');
  const bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('task1');

      this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks - Task 1');
      this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks - Task 2');
    }

    task1 () {
      this.logger.log('MyTasks task1');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }
  }
  bz.add(MyTasks);

  class MyTasks2 extends bz.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('task1');

      this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks2 - Task 1');
      this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks2 - Task 2');
    }

    task1 () {
      this.logger.log('MyTasks2 task1');
    }

    task2 () {
      this.logger.log('MyTasks2 task2');
    }
  }
  bz.add(MyTasks2);

  let p = bz.run('MyTasks', 'MyTasks.task2', 'MyTasks2', 'MyTasks2.task2');
  // prints help results
  // bz.printHelp();
/* Output:
MyTasks task1
MyTasks task2
MyTasks2 task1
MyTasks2 task2
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$register"><a href="#$register">#</a>&nbsp;<code>$register()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L384 "View in source") [&#x24C9;][1]

Register the Task with BZ

#### Returns
*(object)*: Promise

---

<!-- /div -->

<!-- div -->

<h3 id="$run"><a href="#$run">#</a>&nbsp;<code>$run(args)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L661 "View in source") [&#x24C9;][1]

Runs task(s) - multi args run in sequence, arrays are run in parallel

#### Arguments
1. `args` *(function|string): task(s)*

#### Returns
*(object)*: Promise

---

<!-- /div -->

<!-- div -->

<h3 id="$sequence"><a href="#$sequence">#</a>&nbsp;<code>$sequence(args)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L640 "View in source") [&#x24C9;][1]

Runs task(s) in sequence

#### Arguments
1. `args` *(object|string): task(s)*

#### Returns
*(Object)*: Promise

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    _delay (message, delay = 300) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.logger.log(message);
          resolve();
        }, delay);
      });
    }

    task1 () {
      this.logger.log('MyTasks task1');
      return this.$sequence('.task3', '.task4');
    }

    task2 () {
      return this._delay('MyTasks task2', 200);
    }

    task3 () {
      this.logger.log('MyTasks task3');
      return this.$run('.task5', '.task6');
    }

    task4 () {
      return this._delay('MyTasks task4', 400);
    }

    task5 () {
      this.logger.log('MyTasks task5');
    }

    task6 () {
      return this._delay('MyTasks task6', 600);
    }
}

  bz.add(MyTasks);
  // params are run in sequence
  let p = bz.run('MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks task1
MyTasks task3
MyTasks task5
MyTasks task6
MyTasks task4
MyTasks task2
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$setDefault"><a href="#$setDefault">#</a>&nbsp;<code>$setDefault(taskFuncName)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L165 "View in source") [&#x24C9;][1]

Set a Task as default

#### Arguments
1. `taskFuncName` *(string): This Class &#42;(Task)*&#42; function name

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyRootLevel extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$useAsRoot();
    }

    task1 () {
      this.logger.log('MyRootLevel task1');
    }

    task2 () {
      this.logger.log('MyRootLevel task2');
    }
  }

  class MyTasks1 extends Beelzebub.Tasks {
    default () {
      this.logger.log('MyTasks1 default');
    }
  }

  class MyTasks2 extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('myDefault');
    }

    myDefault () {
      this.logger.log('MyTasks2 myDefault');
    }
  }

  bz.add(MyRootLevel);
  bz.add(MyTasks1);
  bz.add(MyTasks2);

  let p = bz.run(
    'task1',
    'task2',
    'MyTasks1',
    'MyTasks1.default',
    'MyTasks2',
    'MyTasks2.myDefault'
  );
/* Output:
MyRootLevel task1
MyRootLevel task2
MyTasks1 default
MyTasks1 default
MyTasks2 myDefault
MyTasks2 myDefault
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$setGlobalVars"><a href="#$setGlobalVars">#</a>&nbsp;<code>$setGlobalVars(vars)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L262 "View in source") [&#x24C9;][1]

Set Global Vars

#### Arguments
1. `vars` *(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$setName"><a href="#$setName">#</a>&nbsp;<code>$setName(name)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L189 "View in source") [&#x24C9;][1]

Set name of Task Group/Class, when refering to Task Group in CLI or other Tasks

#### Arguments
1. `name` *(string)*: New name of Task Group/Class

---

<!-- /div -->

<!-- div -->

<h3 id="$setSubTask"><a href="#$setSubTask">#</a>&nbsp;<code>$setSubTask(name, task)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L231 "View in source") [&#x24C9;][1]

Set SubTask

#### Arguments
1. `name` *(string)*: Name of Sub Task
2. `task` *(string)*: Task Class

---

<!-- /div -->

<!-- div -->

<h3 id="$setSubTasks"><a href="#$setSubTasks">#</a>&nbsp;<code>$setSubTasks(tasks)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L254 "View in source") [&#x24C9;][1]

Set All Sub Task(s)

#### Arguments
1. `tasks` *(object)*:

---

<!-- /div -->

<!-- div -->

<h3 id="$setTaskHelpDocs"><a href="#$setTaskHelpDocs">#</a>&nbsp;<code>$setTaskHelpDocs(taskName, helpDocs)</code></h3>
[&#x24C8;](../lib/bzTasks.js#L293 "View in source") [&#x24C9;][1]

Set Help Docs for Task

#### Arguments
1. `taskName` *(string)*: Name of Task
2. `helpDocs` *(string)*: Help Docs for Task

#### Example
```js
  const Beelzebub = require('../../');
  const bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('task1');

      this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks - Task 1');
      this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks - Task 2');
    }

    task1 () {
      this.logger.log('MyTasks task1');
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }
  }
  bz.add(MyTasks);

  class MyTasks2 extends bz.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('task1');

      this.$setTaskHelpDocs('task1', 'ES7 Decorator Example MyTasks2 - Task 1');
      this.$setTaskHelpDocs('task2', 'ES7 Decorator Example MyTasks2 - Task 2');
    }

    task1 () {
      this.logger.log('MyTasks2 task1');
    }

    task2 () {
      this.logger.log('MyTasks2 task2');
    }
  }
  bz.add(MyTasks2);

  let p = bz.run('MyTasks', 'MyTasks.task2', 'MyTasks2', 'MyTasks2.task2');
  // prints help results
  // bz.printHelp();
/* Output:
MyTasks task1
MyTasks task2
MyTasks2 task1
MyTasks2 task2
*/

```
---

<!-- /div -->

<!-- div -->

<h3 id="$useAsRoot"><a href="#$useAsRoot">#</a>&nbsp;<code>$useAsRoot()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L155 "View in source") [&#x24C9;][1]

Use this Task as root task

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyRootLevel extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$useAsRoot();
    }

    task1 () {
      this.logger.log('MyRootLevel task1');
    }

    task2 () {
      this.logger.log('MyRootLevel task2');
    }
  }

  class MyTasks1 extends Beelzebub.Tasks {
    default () {
      this.logger.log('MyTasks1 default');
    }
  }

  class MyTasks2 extends Beelzebub.Tasks {
    constructor (config) {
      super(config);

      this.$setDefault('myDefault');
    }

    myDefault () {
      this.logger.log('MyTasks2 myDefault');
    }
  }

  bz.add(MyRootLevel);
  bz.add(MyTasks1);
  bz.add(MyTasks2);

  let p = bz.run(
    'task1',
    'task2',
    'MyTasks1',
    'MyTasks1.default',
    'MyTasks2',
    'MyTasks2.myDefault'
  );
/* Output:
MyRootLevel task1
MyRootLevel task2
MyTasks1 default
MyTasks1 default
MyTasks2 myDefault
MyTasks2 myDefault
*/

```
---

<!-- /div -->

<!-- /div -->

<!-- /div -->

 [1]: #methods "Jump back to the TOC."
