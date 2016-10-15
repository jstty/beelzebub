'use strict';

const _     = require('lodash');
const co    = require('co');
const manifest = require('../package.json');

const BzTasks    = require('./bzTasks.js');
const util       = require('./util.js');

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
  }

  init (config = util.DefaultConfig) {
    util.processConfig(config, util.DefaultConfig, this);

    this._config.beelzebub = this; // don't like this, but needed for BzTasks
    this._rootTasks = new BzTasks(this._config);
    this._rootTasks.$useAsRoot();
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

    this._config = _.cloneDeep(util.DefaultConfig);
    this._rootTasks = null;

    this._initFunctionList = [];
    this._initDone = false;
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

      tasks.$setSubTask(this._rootTasks.$getSubTask());
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
    args.unshift(parent);
    // use internal function, because $run bounces back to root level
    return this._rootTasks._run.apply(this._rootTasks, args);
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
    this.drawBox('Help Docs', 80);
    this._rootTasks.$printHelp();
  }

  drawBox (title, width = 60) {
    const sides = {
      'top':          '─',
      'top-mid':      '┬',
      'top-left':     '┌',
      'top-right':    '┐',
      'bottom':       '─',
      'bottom-mid':   '┴',
      'bottom-left':  '└',
      'bottom-right': '┘',
      'left':         '│',
      'left-mid':     '├',
      'mid':          '─',
      'mid-mid':      '┼',
      'right':        '│',
      'right-mid':    '┤',
      'middle':       '│'
    };

    const spaceLen = width - title.length - 5;
    this.logger.log(sides['top-left'] + sides['top'].repeat(width - 2) + sides['top-right']);
    this.logger.log(sides['left'], title, ' '.repeat(spaceLen), sides['right']);
    this.logger.log(sides['bottom-left'] + sides['bottom'].repeat(width - 2) + sides['bottom-right']);
  }
}

module.exports = Beelzebub;
