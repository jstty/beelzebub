'use strict';

const _ = require('lodash');

// internal singleton instance of the class, only created when needed
let beelzebubInst = null;

const DefaultConfig = {
  verbose: false,
  silent:  false,
  logger:  console
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
/**
 * check if function is generator
 * @param {function}
 * @returns {boolean}
 */
function isGenerator (func) {
  return (func &&
          func.constructor &&
          func.constructor.name === 'GeneratorFunction');
}

/**
 * check if function is promise
 * @param {object} Promise
 * @returns {boolean}
 */
function isPromise (p) {
  return (p && _.isObject(p) && _.isFunction(p.then));
}

/**
 * check if function is stream
 * @param {object} Stream
 * @returns {boolean}
 */
function isStream (s) {
  return (s && _.isObject(s) && _.isFunction(s.pipe));
}

/**
 * check if object is BzTask
 * @param {object}
 * @returns {boolean}
 * Note: can't use instanceof as the source might be a different modules but exactly the same
 */
function isBaseTask (a) {
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

function processConfig (config, parentConfig, contex) {
  if (config.logger) {
    contex.logger = config.logger;
  } else {
    contex.logger = parentConfig.logger || DefaultConfig.logger;
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

module.exports = {
  beelzebubInst: beelzebubInst,
  DefaultConfig: DefaultConfig,
  nullLogger:    nullLogger,
  processConfig: processConfig,
  isGenerator:   isGenerator,
  isPromise:     isPromise,
  isStream:      isStream,
  isBaseTask:    isBaseTask
};
