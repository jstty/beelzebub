'use strict';

const _  = require('lodash');
const fs = require('fs');

// internal singleton instance of the class, only created when needed
let beelzebubInst = null;

const DefaultConfig = {
  verbose: false,
  silent:  false,
  logger:  null
};

const nullLogger = {
  log:   function () {},
  warn:  function () {},
  info:  function () {},
  error: function () {},
  trace: function () {},

  clear:          function () {},
  count:          function () {},
  debug:          function () {},
  dir:            function () {},
  dirxml:         function () {},
  group:          function () {},
  groupCollapsed: function () {},
  groupEnd:       function () {},
  profile:        function () {},
  profileEnd:     function () {},
  time:           function () {},
  timeEnd:        function () {},
  timeStamp:      function () {}
};

/**
 * ========================================================
 * Util Functions
 * ========================================================
 */
class BzUtils {

  /**
   * get singleton instance of beelzebub
   * @return beelzebub instance
   */
  static getInstance () {
    return beelzebubInst;
  }

  /**
   * sets singleton instance of beelzebub
   * @param {object}
   * @return beelzebub instance
   */
  static setInstance (inst) {
    beelzebubInst = inst;
    return beelzebubInst;
  }

  /**
   * get singleton instance of beelzebub
   * @return beelzebub instance
   */
  static getInstance () {
    return beelzebubInst;
  }

  /**
   * sets singleton instance of beelzebub
   * @param {object}
   * @return beelzebub instance
   */
  static setInstance (inst) {
    beelzebubInst = inst;
    return beelzebubInst;
  }

  /**
   * check if function is generator
   * @param {function}
   * @returns {boolean}
   */
  static isGenerator (func) {
    return (func &&
            func.constructor &&
            func.constructor.name === 'GeneratorFunction');
  }

  /**
   * check if function is promise
   * @param {object} Promise
   * @returns {boolean}
   */
  static isPromise (p) {
    return (p && _.isObject(p) && _.isFunction(p.then));
  }

  /**
   * check if function is stream
   * @param {object} Stream
   * @returns {boolean}
   */
  static isStream (s) {
    return (s && _.isObject(s) && _.isFunction(s.pipe));
  }

  /**
   * check if object is BzTask
   * @param {object}
   * @returns {boolean}
   * Note: can't use instanceof as the source might be a different modules but exactly the same
   */
  static isBaseTask (a) {
    const checkList = [
      '$sequence',
      '$parallel',
      '$run',
      '$setDefault',
      '$isRoot',
      '$useAsRoot',
      '$setName',
      '$getName',
      '$getTask',
      '$setSubTask',
      '$getSubTask'
    ];
    return _.reduce(checkList, (result, key) => {
      if (!result) return result;
      if (!a[key] || !_.isFunction(a[key])) {
        result = false;
      }
      return result;
    });
    // return b.prototype.isPrototypeOf(a);
    // return a instanceof b;
  }

  /**
   * reads json string from file
   * @param {string}
   * @returns {object}
   * Note: it could not load file or invalid json, will return NULL
   */
  static readJsonFile(file) {
    let jsonData = null;
    try {
      let fileData = fs.readFileSync(file);
      jsonData = JSON.parse(fileData);
    }
    catch(err) {
      console.error('Error Reading File:', err);
    }
  
    return jsonData;
  }

  // TODO: write doc info here
  static processConfig (config, parentConfig, contex) {
    if (config.logger) {
      contex.logger = config.logger;
    } else {
      contex.logger = parentConfig.logger;
    }

    if (config.helpLogger) {
      contex.helpLogger = config.helpLogger;
    } else {
      contex.helpLogger = parentConfig.helpLogger;
    }

    // this._config = _.merge(DefaultConfig, config || {});
    contex._config = _.merge(_.cloneDeep(DefaultConfig), _.cloneDeep(parentConfig), config || {});

    if (contex._config.silent) {
      contex.logger = nullLogger;
    }
    contex._config.logger = contex.logger;

    contex.vLogger = {
      log:  function () {},
      info: function () {}
    };
    if (contex._config.verbose) {
      contex.vLogger = {
        log:  (...args) => { args.unshift(`[${contex.name}] -`); contex.logger.log(...args); },
        info: (...args) => { args.unshift(`[${contex.name}] -`); contex.logger.info(...args); }
      };
    }
  }

  /**
   * task objects have a 'task' key and it's either a string or function
   * @param {object}
   * @returns {boolean}
   */
  static isTaskObject (obj) {
    if (obj.hasOwnProperty('task')) {
      if (_.isString(obj.task) || _.isFunction(obj.task)) {
        return true;
      }
    }

    return false;
  }

  /**
   * gets current time and memory usage
   * @returns {object}
   */
  static getStats () {
    let time = process.hrtime();
    time = time[0] * 1e3 + time[1] / 1e6;
    return {
      time:   time,
      memory: process.memoryUsage()
    };
  }

  /**
   * calculates differance of "stats" object, returns result
   * @param {object, object}
   * @returns {object}
   */
  static calcStatsDiff (start, end) {
    let memory = {
      heapTotal: 0,
      heapUsed:  0,
      rss:       0
    };

    if (end.memory && start.memory) {
      memory.heapTotal = end.memory.heapTotal - start.memory.heapTotal;
      memory.heapUsed = end.memory.heapUsed - start.memory.heapUsed;
      memory.rss = end.memory.rss - start.memory.rss;
    }

    return {
      time:   end.time - start.time,
      memory: memory
    };
  }
}

module.exports = {
  getInstance:   BzUtils.getInstance,
  setInstance:   BzUtils.setInstance,
  DefaultConfig: DefaultConfig,
  nullLogger:    nullLogger,
  processConfig: BzUtils.processConfig,
  getStats:      BzUtils.getStats,
  calcStatsDiff: BzUtils.calcStatsDiff,
  isGenerator:   BzUtils.isGenerator,
  isPromise:     BzUtils.isPromise,
  isStream:      BzUtils.isStream,
  isBaseTask:    BzUtils.isBaseTask,
  isTaskObject:  BzUtils.isTaskObject,
  readJsonFile:  BzUtils.readJsonFile
};
