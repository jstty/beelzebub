'use strict';
const EventEmitter = require('events');

const _        = require('lodash');
const co       = require('co');
const Stumpy   = require('stumpy');
const strftime = require('strftime');

// const sparkline = require('sparkline');
const Table     = require('cli-table3');

const manifest = require('../package.json');

const BzTasks = require('./bzTasksClass.js');
const bzStats = require('./bzStats.js');
const util    = require('./util.js');

/**
 * ========================================================
 * Beelzebub Class
 * ========================================================
 */
class Beelzebub {
  constructor (config) {
    this.version = manifest.version;
    this.reset();
    this.init(config);

    // add Tasks to Beelzebub
    this.Tasks = BzTasks;

    this.events = new EventEmitter();
  }

  init (config = util.DefaultConfig) {
    // if logger not defined
    if (!config.logger) {
      let stumpy = new Stumpy({
        dateStringFunc: function customDateStringFunc (date) {
          // display time diff from start
          let diffStats = this._stats.getCurrentDiffStats();
          return strftime('%M:%S.%L', new Date(diffStats.time));
        }.bind(this),
        group: {
          autoIndent: true,
          indent:     {
            // https://github.com/cli-table/cli-table3/blob/master/src/utils.js
            start: '└─┐',
            line:  '  ├',
            end:   '┌─┘',
            inner: '  ',
            split: '  ',
            join:  '  '
          }
        }
      });

      config.logger = stumpy;
    }

    // if helpLogger not defined
    if (!config.helpLogger) {
      let helpStumpy = new Stumpy('Help', {
        formatFunc: function customFormatFunc (log, options) {
          return log.args;
        }
      });
      config.helpLogger = helpStumpy;
    }

    util.processConfig(config, util.DefaultConfig, this);

    this._config.beelzebub = this; // don't like this, but needed for BzTasks
    this._rootTasks = new BzTasks(this._config, true);
    this._rootTasks.$useAsRoot();

    this._stats = new bzStats.Task();
  }

  reset () {
    // logger util
    // TODO: move this to util
    this.logger = console;

    // verbose logger
    // TODO: move over to stumpy
    this.vLogger = {
      log:  function () {},
      info: function () {}
    };

    this.helpLogger = console;

    this._config = _.cloneDeep(util.DefaultConfig);
    this._rootTasks = null;

    this._initFunctionList = [];
    this._initDone = false;
    this._tasksRunning = false;
    this._globalVars = {};
  }

  getConfig () {
    return this._config;
  }

  setGlobalVars (vars) {
    this._globalVars = vars;
  }

  getGlobalVars () {
    return this._globalVars;
  }

  isLoading () {
    return !this._initDone;
  }

  addInitFunction (func) {
    this._initFunctionList.push(func);
  }

  getInitPromise () {
    let func = co.wrap(function *() {
      let results = [];
      for (let i = 0; i < this._initFunctionList.length; i++) {
        let result = yield this._initFunctionList[i]();
        results.push(result);
      }

      // this.vLogger.log('runTask initFunctionList done results:', results);
      this._initDone = true;

      return results;
    }.bind(this));

    return func();
  }

  getRunning () {
    return this._rootTasks.$getRunning();
  }

  getVarDefsForTaskName (taskName) {
    return this._rootTasks.$getVarDefsForTaskName(taskName);
  }

  /**
   * add event on listener
   * @param {string} name - name to listen for
   * @param {string} filter - (optional)  // TODO: add regex support
   * @param {function} cb - funtion callback
   */
  on (name, filter, callback) {
    if (_.isObject(name)) {
      const eventInfo = name;
      name = eventInfo.name;
      filter = eventInfo.task;
      callback = eventInfo.callback;
    }

    if (_.isFunction(filter)) {
      callback = filter;
      filter = undefined;
    }

    const bzThis = this;
    this.events.on(name, (taskInfo, data) => {
      // apply filter if exist
      if (filter) {
        if (taskInfo.task === filter) {
          callback.call(bzThis, taskInfo, data);
        }
      } else {
        callback.call(bzThis, taskInfo, data);
      }
    });
  }

  emit (name, taskInfo, data) {
    this.events.emit(name, taskInfo, data);
  }

  add (Tasks, config) {
    let tasks = null;

    if (_.isString(Tasks)) {
      try {
        // TODO: yanpm install this?
        Tasks = require(Tasks);
      }
      catch (err) {
        this.logger.error('Add Task Error:', err);
        return;
      }
    }

    if (_.isFunction(Tasks) && _.isObject(Tasks)) {
      config = _.merge(this._config, config || {});
      config.beelzebub = this;

      tasks = new Tasks(config || this._config);

      if (!util.isBaseTask(tasks)) {
        this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BzTasks" -', tasks);
        return;
      }
    }
    else if (_.isObject(Tasks) && util.isBaseTask(Tasks)) {
      tasks = Tasks;
    }
    else {
      this.logger.error('Add Task Error: Unknown Task type -', tasks);
      return;
    }

    if (tasks.$isRoot()) {
      // transfer all the current subTasks from old _rootTasks to current

      tasks.$setSubTasks(this._rootTasks.$getSubTasks());
      this._rootTasks = tasks;

      return tasks.$register().then((results) => {
        // this.vLogger.log('task register done:', results);
      });
    } else {
      // this.vLogger.log('rootTask addSubTasks');
      this._rootTasks.$addSubTasks(tasks, config);
    }

    // this.vLogger.log( 'all tasks:', _.keys(this._rootTasks) );
  }

  /**
   * Runs task(s) - multi args run in sequence, arrays are run in parallel
   * @param task(s) (function or string)
   * @returns {Promise}
   */
  run (parent, ...args) {
    // used to determine if this is the entry point to run the first task
    let entryPoint = false;
    if (!this._tasksRunning) {
      entryPoint = true;
      this._tasksRunning = true;
      this._stats.start();
    }

    args.unshift(parent);
    // use internal function, because $run bounces back to root level
    return this._rootTasks._run.apply(this._rootTasks, args)
    .then(() => {
      // if it was the entry point then run afterAll
      if (entryPoint) {
        return this._rootTasks._runAfterAll.apply(this._rootTasks)
          .then(() => {
            this._stats.end();
            this._printSummary();
          });
      }
    });
  }

  sequence (parent, ...args) {
    args.unshift(parent);
    // use internal function, because $sequence bounces back to root level
    return this._rootTasks._sequence.apply(this._rootTasks, args);
  }

  parallel (parent, ...args) {
    args.unshift(parent);
    // use internal function, because $parallel bounces back to root level
    return this._rootTasks._parallel.apply(this._rootTasks, args);
  }

  printHelp () {
    this.drawBox('Help Docs');
    this._rootTasks.$printHelp();
  }

  $getTaskTree () {
    return this._rootTasks.$getTaskTree();
  }

  $getTaskFlatList () {
    return this._rootTasks.$getTaskFlatList();
  }

  _printSummary () {
    this.drawBox('Summary');
    let appTotal = this._stats.getCurrentDiffStats();

    let summary = new bzStats.Summary();
    summary.add(this.$getTaskFlatList());

    let timeStats    = summary.getTimeStats();
    let totalTasks   = summary.getTotalTasks();
    // let perTaskStats = summary.getPerTaskStats();
    // let perTimeStats = summary.getPerTimeStats(1000);

    var table = new Table({
      chars: { 'top': '', 'top-mid': '', 'top-left': '', 'top-right': '', 'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '', 'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '', 'right': '', 'right-mid': '', 'middle': ' ' },
      style: { 'padding-left': 0, 'padding-right': 0 }
    });

    table.push(
      [
        'Tasks',
        'Total:',
        {
          hAlign:  'left',
          content: `${totalTasks},`
        },
        `Per: ${(1000 * totalTasks / appTotal.time).toFixed(2)} sec`
        // ,{
        //   colSpan: 2,
        //   hAlign:  'left',
        //   content: `Times: ${sparkline(perTaskStats.time)}`
        // }
      ],
      [ 'Time', 'Total:',
        `${timeStats.total.toFixed(2)} ms,`,
        `Avg: ${timeStats.avg.toFixed(2)} ms,`,
        `Min: ${timeStats.min.toFixed(2)} ms,`,
        `Max: ${timeStats.max.toFixed(2)} ms`]
    );

    this.helpLogger.log(table.toString());
  }

  drawBox (title, width = 80) {
    var header = new Table({
      colWidths: [width]
    });
    header.push([{
      hAlign:  'left',
      content: title
    }]);
    this.helpLogger.log(header.toString());
  }
}

module.exports = Beelzebub;
