'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash');
var fs = require('fs');

// internal singleton instance of the class, only created when needed
var beelzebubInst = null;

var DefaultConfig = {
  verbose: false,
  silent: false,
  logger: null
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

var BzUtils = function () {
  function BzUtils() {
    (0, _classCallCheck3.default)(this, BzUtils);
  }

  (0, _createClass3.default)(BzUtils, null, [{
    key: 'getInstance',


    /**
     * get singleton instance of beelzebub
     * @return beelzebub instance
     */
    value: function getInstance() {
      return beelzebubInst;
    }

    /**
     * sets singleton instance of beelzebub
     * @param {object}
     * @return beelzebub instance
     */

  }, {
    key: 'setInstance',
    value: function setInstance(inst) {
      beelzebubInst = inst;
      return beelzebubInst;
    }

    /**
     * get singleton instance of beelzebub
     * @return beelzebub instance
     */

  }, {
    key: 'getInstance',
    value: function getInstance() {
      return beelzebubInst;
    }

    /**
     * sets singleton instance of beelzebub
     * @param {object}
     * @return beelzebub instance
     */

  }, {
    key: 'setInstance',
    value: function setInstance(inst) {
      beelzebubInst = inst;
      return beelzebubInst;
    }

    /**
     * check if function is generator
     * @param {function}
     * @returns {boolean}
     */

  }, {
    key: 'isGenerator',
    value: function isGenerator(func) {
      return func && func.constructor && func.constructor.name === 'GeneratorFunction';
    }

    /**
     * check if function is promise
     * @param {object} Promise
     * @returns {boolean}
     */

  }, {
    key: 'isPromise',
    value: function isPromise(p) {
      return p && _.isObject(p) && _.isFunction(p.then);
    }

    /**
     * check if function is stream
     * @param {object} Stream
     * @returns {boolean}
     */

  }, {
    key: 'isStream',
    value: function isStream(s) {
      return s && _.isObject(s) && _.isFunction(s.pipe);
    }

    /**
     * check if object is BzTask
     * @param {object}
     * @returns {boolean}
     * Note: can't use instanceof as the source might be a different modules but exactly the same
     */

  }, {
    key: 'isBaseTask',
    value: function isBaseTask(a) {
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

    /**
     * reads json string from file
     * @param {string}
     * @returns {object}
     * Note: it could not load file or invalid json, will return NULL
     */

  }, {
    key: 'readJsonFile',
    value: function readJsonFile(file) {
      var jsonData = null;
      try {
        var fileData = fs.readFileSync(file);
        jsonData = JSON.parse(fileData);
      } catch (err) {
        console.error('Error Reading File:', err);
      }

      return jsonData;
    }

    // TODO: write doc info here

  }, {
    key: 'processConfig',
    value: function processConfig(config, parentConfig, contex) {
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

    /**
     * task objects have a 'task' key and it's either a string or function
     * @param {object}
     * @returns {boolean}
     */

  }, {
    key: 'isTaskObject',
    value: function isTaskObject(obj) {
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

  }, {
    key: 'getStats',
    value: function getStats() {
      var time = process.hrtime();
      time = time[0] * 1e3 + time[1] / 1e6;
      return {
        time: time,
        memory: process.memoryUsage()
      };
    }

    /**
     * calculates differance of "stats" object, returns result
     * @param {object, object}
     * @returns {object}
     */

  }, {
    key: 'calcStatsDiff',
    value: function calcStatsDiff(start, end) {
      var memory = {
        heapTotal: 0,
        heapUsed: 0,
        rss: 0
      };

      if (end.memory && start.memory) {
        memory.heapTotal = end.memory.heapTotal - start.memory.heapTotal;
        memory.heapUsed = end.memory.heapUsed - start.memory.heapUsed;
        memory.rss = end.memory.rss - start.memory.rss;
      }

      return {
        time: end.time - start.time,
        memory: memory
      };
    }
  }]);
  return BzUtils;
}();

module.exports = {
  getInstance: BzUtils.getInstance,
  setInstance: BzUtils.setInstance,
  DefaultConfig: DefaultConfig,
  nullLogger: nullLogger,
  processConfig: BzUtils.processConfig,
  getStats: BzUtils.getStats,
  calcStatsDiff: BzUtils.calcStatsDiff,
  isGenerator: BzUtils.isGenerator,
  isPromise: BzUtils.isPromise,
  isStream: BzUtils.isStream,
  isBaseTask: BzUtils.isBaseTask,
  isTaskObject: BzUtils.isTaskObject,
  readJsonFile: BzUtils.readJsonFile
};