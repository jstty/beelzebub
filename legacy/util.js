'use strict';

var _ = require('lodash');

// internal singleton instance of the class, only created when needed
var beelzebubInst = null;

var DefaultConfig = {
  verbose: false,
  silent: false,
  logger: console
};

var nullLogger = {
  log: function log() {},
  warn: function warn() {},
  info: function info() {},
  error: function error() {},
  trace: function trace() {},

  clear: function clear() {},
  count: function count() {},
  debug: function debug() {},
  dir: function dir() {},
  dirxml: function dirxml() {},
  group: function group() {},
  groupCollapsed: function groupCollapsed() {},
  groupEnd: function groupEnd() {},
  profile: function profile() {},
  profileEnd: function profileEnd() {},
  time: function time() {},
  timeEnd: function timeEnd() {},
  timeStamp: function timeStamp() {}
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
function isGenerator(func) {
  return func && func.constructor && func.constructor.name === 'GeneratorFunction';
}

/**
 * check if function is promise
 * @param {object} Promise
 * @returns {boolean}
 */
function isPromise(p) {
  return p && _.isObject(p) && _.isFunction(p.then);
}

/**
 * check if function is stream
 * @param {object} Stream
 * @returns {boolean}
 */
function isStream(s) {
  return s && _.isObject(s) && _.isFunction(s.pipe);
}

/**
 * check if object is BzTask
 * @param {object}
 * @returns {boolean}
 * Note: can't use instanceof as the source might be a different modules but exactly the same
 */
function isBaseTask(a) {
  var checkList = ['$sequence', '$parallel', '$run', '$setDefault', '$isRoot', '$useAsRoot', '$setName', '$getName', '$getTask', '$setSubTask', '$getSubTask'];
  return _.reduce(checkList, function (result, key) {
    if (!result) return result;
    if (!a[key] || !_.isFunction(a[key])) {
      result = false;
    }
    return result;
  });
  // return b.prototype.isPrototypeOf(a);
  // return a instanceof b;
}

function processConfig(config, parentConfig, contex) {
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
    log: function log() {},
    info: function info() {}
  };
  if (contex._config.verbose) {
    contex.vLogger = {
      log: function log() {
        var _contex$logger;

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        args.unshift('[' + contex.name + '] -');(_contex$logger = contex.logger).log.apply(_contex$logger, args);
      },
      info: function info() {
        var _contex$logger2;

        for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        args.unshift('[' + contex.name + '] -');(_contex$logger2 = contex.logger).info.apply(_contex$logger2, args);
      }
    };
  }
}

module.exports = {
  beelzebubInst: beelzebubInst,
  DefaultConfig: DefaultConfig,
  nullLogger: nullLogger,
  processConfig: processConfig,
  isGenerator: isGenerator,
  isPromise: isPromise,
  isStream: isStream,
  isBaseTask: isBaseTask
};