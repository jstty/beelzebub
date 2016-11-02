'use strict';

const _        = require('lodash');
const when     = require('when');
const co       = require('co');
const chalk    = require('chalk');
const whenSeq  = require('when/sequence');
const streamToPromise = require('stream-to-promise');

const manifest = require('../package.json');
const util     = require('./util.js');

/**
 * ========================================================
 * Beelzebub Task Class, should be extended
 * ========================================================
 */
class BzTasks {
  constructor (config) {
    this.beelzebub = config.beelzebub || util.beelzebubInst;

    util.processConfig(config, this.beelzebub.getConfig(), this);

    this.name = config.name || this.constructor.name || 'BzTasks';
    this.version = manifest.version;
    this.namePath = this._buildNamePath(config);
    // this.vLogger.log('constructor namePath:', this.namePath, ', name:', this.name);

    // TODO: use config function/util to process this

    this._rootLevel = false;
    this._defaultTaskFuncName = this.$defaultTask || null;
    this._tasks = {};
    this._subTasks = {};

    this._running = null;

    // TODO: add cli options/commands
  }

  _buildNamePath (config) {
    let namePath = this.name;
    if (config.parentPath) {
      namePath = config.parentPath + '.' + config.name;
    }
    return namePath;
  }

  $printHelp () {
    _.forEach(this.$getSubTasks(), (task) => {
      task.$printHelp();
    });

    if (this.$helpDocs) {
      this.beelzebub.drawBox(this.name);
      _.forEach(this.$helpDocs, (doc, taskName) => {
        this.logger.log(chalk.bold.underline(taskName));
        this.logger.log('\t', doc, '\n');
      });
    }
  }

  $useAsRoot () {
    this._rootLevel = true;
    this.name = '$root$';
  }

  $setDefault (taskFuncName) {
    this._defaultTaskFuncName = taskFuncName;
  }

  $isRoot () {
    return this._rootLevel;
  }

  $setName (name) {
    this.name = name;
  }

  $getName () {
    return this.name;
  }
  
  $getTask (name) {
    return this._tasks[name];
  }
  $hasTask (name) {
    return this._tasks.hasOwnProperty(name);
  }

  $getSubTask (name) {
    return this._subTasks[name];
  }
  $setSubTask (name, task) {
    this._subTasks[name] = task;
  }
  $hasSubTask (name) {
    return this._subTasks.hasOwnProperty(name);
  }

  $getSubTasks () {
    return this._subTasks;
  }
  $setSubTasks (tasks) {
    this._subTasks = tasks;
  }

  $setGlobalVars (vars) {
    this.beelzebub.setGlobalVars(vars);
  }

  $getGlobalVars () {
    return this.beelzebub.getGlobalVars();
  }

  $defineTaskVars(taskName, taskDef) {
    if (!_.isObject(this.$varDefs)) {
      this.$varDefs = {};
    }
    
    this.$varDefs[taskName] = taskDef;
  }

  $setTaskHelpDocs(taskName, helpDocs) {
    if (!_.isObject(this.$helpDocs)) {
      this.$helpDocs = {};
    }
    
    this.$helpDocs[taskName] = helpDocs;
  }

  $getVarDefsForTaskName (taskStr) {
    let taskParts = taskStr.split('.');
    let taskName = taskParts.shift();
    if (!taskName || !taskName.length) {
      taskName = 'default';
    }
    // this.vLogger.log('taskName:', taskName);
    // this.vLogger.log('taskParts:', taskParts);

    if(this.$hasSubTask(taskName)) {
      let newTaskName = taskParts.join('.');
      // this.vLogger.log('newTaskName:', newTaskName);
      return this.$getSubTask(taskName).$getVarDefsForTaskName(newTaskName);
    }
    else if(this.$hasTask(taskName)) {
      if(!this.$varDefs || _.keys(this.$varDefs).length === 0) { 
        return null;
      }
      return this.$varDefs[taskName];
    } 
  }

  $init () {
    return null;
  }

  $getRunning () {
    return this._running;
  }

  $register () {
    // this.vLogger.log('$register start');
    let tList = [];

    this._bfsTaskBuilder(tList, this);

    // run init, running as optimal to shortcut $init's that don't return promises
    let initPromise = this._normalizeExecFuncToPromise(this.$init, this);

    // this.vLogger.log('$register bfsTaskBuilder outList:', tList);
    this._addTasks(tList, this);

    return initPromise
      // .then((results) => {
      //   this.vLogger.log('$register initFunctionList done:', results);
      // })
      .then((results) => {
        // this.vLogger.log('$register initFunctionList done:', results);
        return results;
      });
  }

  _addTasks (tList, task) {
    // this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', rootLevel:', this._rootLevel, ', this != task:', this != task);

    _.forEach(tList, (funcName) => {
      let taskId = '';

      if ((this !== task) && !this._rootLevel) {
        taskId += task.name + '.';
      }
      taskId += funcName;

      if (funcName === this._defaultTaskFuncName) {
        taskId = 'default'; // set taskId to 'default'
      }

      // this.vLogger.log('taskId:', taskId);
      this._tasks[taskId] = {
        taskId:   taskId,
        tasksObj: task,
        func:     task[funcName]
      };
    });
  }

  // TODO: ??? combine the logic of 'add' and 'addSubTasks'
  // move to recursive run model using task $register instead of mixing sub tasks with current task class
  $addSubTasks (Task, config = {}) {
    if (!this.beelzebub.isLoading()) {
      // this.logger.error('$addSubTasks can only be called during init');
      return when.reject();
    }

    let task = null;
    if (_.isFunction(Task) && _.isObject(Task)) {
      config.parentPath = this.namePath;
      task = new Task(config);
    } else {
      task = Task;
    }

    // this.vLogger.log('$addSubTasks addInitFunction', task.name);
    this.beelzebub.addInitFunction(() => {
      return task.$register();
    });

    // this.vLogger.log('task:', task);
    this.$setSubTask(task.$getName(), task);
  }

  _normalizeExecFuncToPromise (func, parent, vars) {
    let p = null;
    // this.logger.log('normalizeExecFuncToPromise',
    // 'isPromise:', isPromise(func),
    // ', isGenerator:', isGenerator(func),
    // ', isFunction:', _.isFunction(func));

    // func already a promise
    if (util.isPromise(func)) {
      p = func;
    }
    // func is a generator function
    else if (util.isGenerator(func)) {
      // run generator using co
      if (parent) {
        p = co(func.bind(parent, vars));
      } else {
        p = co(func.bind(func, vars));
      }
    }
    // if task is function, run it
    else if (_.isFunction(func)) {
      if (parent) {
        p = func.apply(parent, [vars]);
      } else {
        p = func(vars);
      }
    } else {
      // TODO: check other
      this.logger.warn('other type?? func:', func, ', parent:', parent);
    }

    // this.logger.log('normalizeExecFuncToPromise',
    // 'isStream:', isStream(p),
    // ', isPromise:', isPromise(p),
    // ', optimize:', optimize);

    // convert streams to promise
    if (util.isStream(p)) {
      p = streamToPromise(p);
    }

    if (!util.isPromise(p)) {
      p = when.resolve(p);
    }

    return p;
  }

  _bfsTaskBuilder (outList, task, name) {
    let proto = Object.getPrototypeOf(task);
    // this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

    if (proto && _.isObject(proto)) {
      // this.vLogger.log('name:', name, ', task.name:', task.name);
      name = name || task.name;
      let oproto = this._bfsTaskBuilder(outList, proto, name);
      if (Object.getPrototypeOf(oproto) && !(oproto === BzTasks.prototype)) {
        // this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BzTasks:', (oproto === BzTasks.prototype));

        let tList = Object.getOwnPropertyNames(oproto);
        tList = tList.filter((p) => {
          return (
            _.isFunction(task[p]) &&
            (p !== 'constructor') /* NOT constructor */ &&
            (p[0] !== '_')        /* doesn't start with underscore */ &&
            (p[0] !== '$')        /* doesn't start with $ */
          );
        });

        // this.vLogger.log('name:', name, ', oproto:', oproto, ', tList:', tList);

        for (let i = 0; i < tList.length; i++) {
          outList.push(tList[i]);
        }
      }
    }

    return task;
  }

  /**
   * Runs task(s) in sequence
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  $sequence (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.sequence(this, ...args);
  }

  /**
   * Runs task(s) in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  $parallel (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.parallel(this, ...args);
  }

  /**
   * Runs task(s) - multi args run in sequence, arrays are run in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  $run (...args) {
    // TODO: prevent infinite loop
    return this.beelzebub.run(this, ...args);
  }

  _waitForInit() {
    let p = null;

    // wait for self to complete
    if (this.beelzebub.isLoading()) {
      p = this.beelzebub.getInitPromise();
    } else {
      p = when.resolve();
    }

    return p;
  }

  /**
   * Internal Run task(s) in sequence
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  _sequence (parent, ...args) {
    // this.vLogger.log('sequence args:', args);
    // this.vLogger.log('sequence parent:', parent);

    if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('sequence args:', args);
    }

    return this._waitForInit().then(() => {
      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      let aTasks = [];
      _.forEach(args, (task) => {
        aTasks.push(() => {
          return this._runPromiseTask(parent, task);
        });
      });

      // this.vLogger.log('sequence args:', aTasks);
      return whenSeq(aTasks);
    });
  }

  /**
   * Internal Runs task(s) in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  _parallel (parent, ...args) {
    // this.vLogger.log('parallel args:', args);

    if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('parallel args:', args);
    }

    return this._waitForInit().then(() => {
      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      let pList = _.map(args, (task) => {
        return this._runPromiseTask(parent, task);
      });

      // this.vLogger.log('parallel pList:', pList);
      return when.all(pList);
    });
  }

  /**
   * Runs task(s) - multi args run in sequence, arrays are run in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  _run (parent, ...args) {
    // this.vLogger.log('run args:', args);

    if (parent && (_.isString(parent) || _.isArray(parent) || util.isTaskObject(parent))) {
      args.unshift(parent);
      parent = undefined;
      // this.vLogger.log('run args:', args);
    }

    return this._waitForInit().then(() => {
      let promise = null;

      // normalize tasks (aka args)
      args = this._normalizeTask(parent, args);

      if (args.length === 1) {
        promise = this._runPromiseTask(parent, args[0]);
      } else {
        // multi args mean, run in sequence
        promise = this._sequence(parent, ...args);
      }

      this._running = promise.then((result) => {
        this._running = null;
        return result;
      });

      return this._running.catch((e) => {
        this.logger.error(e);
      });
    });
  }

  /**
   * run a task
   * @param task {String}
   * @returns {Promise}
   */
  _runTask (task) {
    // let p = null;

    // // wait for self to complete
    // if (this.beelzebub.isLoading()) {
    //   p = this.beelzebub.getInitPromise();
    // } else {
    //   p = when.resolve();
    // }

    // return p.then(() => {
      // this.vLogger.log('task class:', this.name
      //   , ', running task:', task
      //   , ', all tasks:', _.keys(this._tasks)
      //   , ', all subTasks:', _.keys(this.$getSubTasks()));
      
      // if no task specified, then use default
      if (!task) {
        task = { task: 'default' };
        // console.error('setting to default');
      }

      let taskParts = task.task.split('.');
      let taskPartsUnderscored = taskParts.join('_');
      let taskName = taskParts.shift();
      if (!taskName || !taskName.length) {
        taskName = 'default';
      }

      if (this.$hasSubTask(taskName)) {
        task.task = taskParts.join('.');
        return this.$getSubTask(taskName)._runTask(task);
      }
      else if (this.$hasTask(taskPartsUnderscored) || this.$hasTask(taskName)) {
        let taskObj = this.$getTask(taskPartsUnderscored) || this.$getTask(taskName);
        return this._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj, task.vars);
      } else {
        this.logger.error(`Task "${taskName}" - not found`);
      }
    // });
  }

  /**
   * Runs task
   * @param parent object
   * @param task (function or string)
   * @returns {Promise}
   */
  // TODO: issues, need to circle back around to top level BZ and trickle down
  // TODO: can we merge this with runTask?
  // so it can recursivly chain down to resolve promises all the way down
  _runPromiseTask (parent, task) {
    let p = null;

    // if task is array, then run in parallel
    if (_.isArray(task)) {
      return this._parallel(parent, ...task);
    }
    // if task is object, then find function and parent in list
    else if (_.isObject(task)) {
      let taskParts = [];
      let taskName = 'default';

      // task is function
      if (_.isFunction(task.task)) {
        p = this._normalizeExecFuncToPromise(task.task, parent, task.vars);
      }
      // task is string
      else if (_.isString(task.task)) {
        taskParts = task.task.split('.');
        taskName = taskParts.shift();

        if (!this.$hasTask(taskName)) {
          // now check if in sub level
          if (this.$hasSubTask(taskName)) {
            task.task = taskParts.join('.');
            // this.vLogger.info('runPromiseTask taskName:', taskName, ', runTask:', task.task);
            p = this.$getSubTask(taskName)._runTask(task);
          } else {
            let error = `task name not found: "${task.task}"`;
            this.logger.error(error);
            p = when.reject(error);
          }
        }
      }
      else {
        let error = `invalid task name: "${task.task}"`;
          this.logger.error(error);
          p = when.reject(error);
      }

      // no promise
      if (!p) {
        if (taskParts.length > 0) {
          task.task = taskParts.join('.');
          // this.vLogger.info('runPromiseTask taskName:', taskName, ', runTask:', task.task);
          p = this._tasks[taskName]._runTask(task);
        } else {
          if (this._tasks[taskName]) {
            task = this._tasks[taskName].func;
            parent = this._tasks[taskName].tasksObj;

            p = this._normalizeExecFuncToPromise(task, parent, task.vars);
          } else {
            let error = `task name not found: "${task}"`;
            this.logger.error(error);
            p = when.reject(error);
          }
        }
      }
    }
    else {
      let error = `task type not supported: "${task}"`;
      this.logger.trace(error);
      p = when.reject(error);
    }

    // TODO: what happens to the data at the end? TBD
    return p;
  }

  _normalizeTask (parent, tasks) {
    let objTasks = _.map(tasks, (task) => {
      let taskObj;

      if (_.isString(task)) {
        // if first char "." then relative to parent path
        if (task.charAt(0) === '.') {
          if (!parent) {
            this.logger.trace('parent missing but expected');
          } else {
            task = parent.namePath + task;
          }
        }

        let taskParts = task.split('.');
        let taskName = taskParts.shift();

        let taskFullName = task;
        let taskVarParts = task.split(':');
        let taskVars = {};

        if (taskVarParts.length > 0) {
          taskFullName = taskVarParts.shift();
          taskVars = taskVarParts.join(':');

          // vars a string and empty, this can happen is no vars pass to task string
          if(_.isString(taskVars) && taskVars.length === 0){
            taskVars = {};
          } else {
            try {
              taskVars = JSON.parse(taskVars);
            }
            catch (err) {
              // this is ok
              this.vLogger.warn('Parsing Task Error:', err);
            }
          }
        }

        if (!this.$getSubTask(taskName) && !this.$getTask(taskName)) {
          this.logger.warn(taskFullName, 'task not added');
          return false;
        }

        taskObj = {
          task: taskFullName,
          vars: taskVars
        };
      }
      else if (_.isArray(task)) {
        taskObj = this._normalizeTask(parent, task);
      }
      else if (_.isFunction(task)) {
        taskObj = {
          task: task
        };
      }
      else if (_.isObject(task)) {
        if (!task.hasOwnProperty('task')) {
          this.logger.warn('invalid object: task property required');
          return null;
        }

        return task;
      } else {
        this.logger.warn('unknown task input type');
        return null;
      }

      // make sure vars is object
      if(taskObj.vars === null || taskObj.vars === undefined) {
        taskObj.vars = {};
      }

      if(!_.isObject(taskObj.vars)){
        this.logger.warn('Vars should be an object');
        taskObj.vars = {};
      }

      return taskObj;
    });

    // apply var definitions if they exist
    // definitions -> defaults, data types and requirements
    objTasks = this._applyVarDefsToAllTasks(objTasks);

    // this.vLogger.log('objTasks:', objTasks);
    return objTasks;
  }

  /**
   * @return {object} tasks object
   * @param {object} var defs applied oject
   */
  _applyVarDefsToAllTasks (objTasks) {

    objTasks = _.map(objTasks, (task) => {
      return this._applyVarDefToTask(task);
    });

    return objTasks;
  }


  _applyVarDefToTask (task) {
    if (_.isArray(task)) {
      return _.map(task, (t) => {
        return this._applyVarDefToTask(t);
      });
    }
    // task object and task is string
    else if(_.isObject(task) && _.isString(task.task)) {
      let taskParts = task.task.split('.');
      let taskPartsUnderscored = taskParts.join('_');
      let taskName = taskParts.shift();
      if (!taskName || !taskName.length) {
        taskName = 'default';
      }

      if(this.$hasSubTask(taskName)) {
        // use copy of tasks to pass to child, as we don't want to mutate the task name
        let newTask = _.cloneDeep(task);
        newTask.task = taskParts.join('.');
        newTask = this.$getSubTask(taskName)._applyVarDefToTask(newTask);
        // update task vars
        task.vars = newTask.vars;
      }
      else if(this.$hasTask(taskName) || this.$hasTask(taskPartsUnderscored)) {
        // no vardefs or no keys in object
        if(!this.$varDefs || _.keys(this.$varDefs).length === 0) { 
          return task;
        }
        
        // has vars definition
        if(this.$varDefs[taskName]) {
          // apply def to vars
          task.vars = this._applyVarDefs(this.$varDefs[taskName], task.vars);
        }
      } else {
        this.logger.error(`Task "${taskName}" - not found`);
      }

      return task;
    }
    // could be task is function or something else, but can't look up vardef to apply
    else {
      return task;
    }
  }

  // TODO: need loads of tests to cover all the conditionals
  _applyVarDefs(varDefs, vars) {
    // this.vLogger.info('varDefs:', varDefs);
    // this.vLogger.info('vars:', vars);

    _.forEach(varDefs, (varDef, key) => {
      let type = varDef.type.toLowerCase();

      // if as alias
      if(varDef.alias) {
        let tkey = varDef.alias;
        // if alias var has value, then use this as the key
        if(vars[tkey] !== null && vars[tkey] !== undefined) {
          vars[key] = vars[tkey];
        }
      }

      // var is set to something
      if(vars[key] !== null && vars[key] !== undefined) {
        if(type === 'string') {
          // not string
          if(!_.isString(vars[key])) {
            this.logger.error(`${key} is not a string but defined as one, converting to string`);
            vars[key] = String(vars[key]);
          }
        }
        else if(type === 'number') {
          // not number
          if(!_.isNumber(vars[key])) {
            this.logger.error(`${key} is not a number but defined as one, converting to number`);
            vars[key] = Number(vars[key]);
          }
        }
        else if(type === 'boolean') {
          // not boolean
          if(!_.isBoolean(vars[key])) {
            this.logger.error(`${key} is not a boolean but defined as one, converting to boolean`);
            // is string, only compare if 'true', otherwise false
            if(_.isString(vars[key])) {
              vars[key] = (vars[key].toLowerCase() === 'true');
            }
            // convert all else use Boolean
            else {
              vars[key] = Boolean(vars[key]);
            }
          }
        }
        else if(type === 'array') {
          // not array
          if(!_.isArray(vars[key])) {
            this.logger.error(`${key} is not a array but defined as one, converting to array`);
            
            if(_.isString(vars[key])) {
              try {
                vars[key] = JSON.parse(vars[key]);
              }
              catch(err) {
                // if parsing fails then split the string by commas
                vars[key] = vars[key].split(',');
              }
            }
            else {
              vars[key] = Array(vars[key]);
            }
          }
        }
        else if(type === 'object') {
          if(!_.isObject(vars[key])) {
            this.logger.error(`${key} is not a object but defined as one, converting to object`);

            // convert vars[key] to object
            if(_.isString(vars[key])) {
              try {
                vars[key] = JSON.parse(vars[key]);
              }
              catch(err) {
                // if parsing fails then just stick in data prop
                this.logger.error(`object "${key}" json parsing error: ${err}`);
                vars[key] = { data: vars[key] };
              }
            }
            else {
              vars[key] = { data: vars[key] };
            }
          }

          let varProps = varDef.properties;
          if(!varProps || !_.isObject(varProps)) {
            this.logger.error(`object "${key}" properties is not defined as object, skipping all sub properties.`);
          } else {
            // recursivly check children (properties)
            vars[key] = this._applyVarDefs(varProps, vars[key]); 
          }
        }
        else {
          this.logger.warn(`Unknown Variable Definition Type: ${type}`);
        }
      }
      // not set to anything
      else {
        if(varDef.required) {
          this.logger.error(`Var "${key}" is required but not set in vars.`);
        }

        let defValue = null;
        if(type === 'string')       { defValue = ''; }
        else if(type === 'number')  { defValue = 0; }
        else if(type === 'boolean') { defValue = false; }
        else if(type === 'array')   { defValue = []; }
        else if(type === 'object')  { defValue = {}; }

        // has default
        if(varDef.default) {
          vars[key] = varDef.default;
        }
        // else default to empty string
        else {
          vars[key] = defValue;
        }
      }
    });

    return vars;
  }

}

module.exports = BzTasks;
