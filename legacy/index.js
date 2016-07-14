'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _ = require('lodash');
var co = require('co');
var streamToPromise = require('stream-to-promise');

// TODO: replace ???
var when = require('when');
var whenSequence = require('when/sequence');

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
 * check if function is generator
 * @param function
 * @returns {boolean}
 */
function isGenerator(func) {
    return func && func.constructor && func.constructor.name === 'GeneratorFunction';
}

/**
 * check if function is promise
 * @param Promise
 * @returns {boolean}
 */
function isPromise(p) {
    return p && _.isObject(p) && _.isFunction(p.then);
}

/**
 * check if function is stream
 * @param stream
 * @returns {boolean}
 */
function isStream(s) {
    return s && _.isObject(s) && _.isFunction(s.pipe);
}

/** ******************************************************
 * Beelzebub Class
 ****************************************************** */

var Beelzebub = function () {
    function Beelzebub(config) {
        _classCallCheck(this, Beelzebub);

        this.init(config);
    }

    _createClass(Beelzebub, [{
        key: 'init',
        value: function init(config) {
            this._processConfig(config);

            this._rootTasks = {};
            this._running = null;
        }
    }, {
        key: '_processConfig',
        value: function _processConfig(config) {
            this._config = _.merge(DefaultConfig, config || {});

            if (this._config.silent) {
                this.logger = nullLogger;
            } else {
                this.logger = this._config.logger;
            }

            this.vLogger = {
                log: function log() {},
                info: function info() {}
            };
            if (this._config.verbose) {
                this.vLogger = {
                    log: this.logger.log,
                    info: this.logger.info
                };
            }
        }
    }, {
        key: 'add',
        value: function add(Task, config) {
            var task = null;

            if (_.isString(Task)) {
                try {
                    // TODO: yanpm install this?
                    Task = require(Task);
                } catch (err) {
                    this.logger.error('Add Task Error:', err);
                    return;
                }
            }

            if (_.isFunction(Task) && _.isObject(Task)) {
                config = _.merge(this._config, config || {});
                config.beelzebub = this;

                task = new Task(config || this._config);

                if (!(task instanceof BaseTasks)) {
                    this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BaseTasks" -', task);
                    return;
                }
            } else if (_.isObject(Task) && Task instanceof BaseTasks) {
                task = Task;
            } else {
                this.logger.error('Add Task Error: Unknowen Task type -', task);
                return;
            }

            this._rootTasks[task.$getName()] = task;
            task.$register({}, this);

            // this is the problem, this._tasks not in sync with task.$getTasks() after async funtion
            //this._tasks = _.merge(this._tasks, task.$getTasks());
            //this.vLogger.log( task.$getName(), 'tasks:', task.$getTasks() );
            //this.vLogger.log( 'all tasks:', _.keys(this._rootTasks) );
        }
    }, {
        key: 'normalizeExecFuncToPromise',
        value: function normalizeExecFuncToPromise(func, parent, optimize) {
            var p = null;

            // func already a promise
            if (isPromise(func)) {
                p = func;
            }
            // func is a generator function
            else if (isGenerator(func)) {
                    // run generator using co
                    p = co(func.bind(parent));
                }
                // if task is function, run it
                else if (_.isFunction(func)) {
                        p = func.apply(parent);
                    } else {
                        // TODO: check other
                        this.logger.warn('other type?? task:', task, ', parent:', parent);
                    }

            // convert streams to promise
            if (isStream(p)) {
                p = streamToPromise(p);
            }

            if (!optimize && !isPromise(p)) {
                p = when.resolve(p);
            }

            return p;
        }

        /**
         * Runs task
         * @param parent object
         * @param task (function or string)
         * @returns {Promise}
         */

    }, {
        key: '_runPromiseTask',
        value: function _runPromiseTask(parent, task) {
            var _this = this;

            // if task is array, then run in parrallel
            if (_.isArray(task)) {
                return this.parallel.apply(this, _toConsumableArray(task));
            }

            // if task is string, then find function and parent in list
            if (_.isString(task)) {
                var taskParts = task.split('.');
                var taskName = taskParts[0];

                if (!this._rootTasks.hasOwnProperty(taskName)) {
                    // now check root level
                    taskName = '$root$';
                    if (!this._rootTasks.hasOwnProperty(taskName) || !this._rootTasks[taskName].$getTask(task)) {
                        return when.reject('task name not found: "' + taskName + '"');
                    }
                }

                var taskObj = this._rootTasks[taskName].$getTask(task);
                task = taskObj.func;
                parent = taskObj.tasksObj;
            }

            var p = null;
            if (parent.$isLoading && parent.$isLoading()) {
                p = parent.$loading().then(function (result) {
                    //this.vLogger.log( 'runPromiseTask all tasks:', _.keys(this._tasks), ', result:', result );
                    return _this.normalizeExecFuncToPromise(task, parent);
                });
            } else {
                p = this.normalizeExecFuncToPromise(task, parent);
            }

            // TODO: what happends to the data at the end? TBD
            return p;
        }

        /**
         * Runs task(s) using CLI input
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: 'runCLI',
        value: function runCLI() {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            // TODO: parse CLI input
            args.unshift({});

            return this.run.apply(this, args);
        }

        /**
         * Runs task(s) - multi args run in sequance, arrays are run in parallel
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: 'run',
        value: function run(parent) {
            var taskName = 'default';

            if (this._running != null) {
                this.logger.error('Already running a task:', this._running);
                return when.reject();
            }

            for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
            }

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('sequance args:', args, ', parent:', parent);
            }

            if (args.length === 0) {
                taskName = args[0];
            } else {
                // multi args mean, run in sequance
                return this.sequance.apply(this, args);
            }

            return this._runPromiseTask(parent, taskName);
        }

        // TODO: remove parent?

    }, {
        key: 'sequance',
        value: function sequance(parent) {
            var _this2 = this;

            //this.vLogger.log('sequance args:', args);
            var aTasks = [];

            for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                args[_key3 - 1] = arguments[_key3];
            }

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('sequance args:', args, ', parent:', parent);
            }

            _.forEach(args, function (task) {
                aTasks.push(function () {
                    return _this2._runPromiseTask(parent, task);
                });
            });

            //this.vLogger.log('sequance args:', aTasks);
            return whenSequence(aTasks);
        }

        // TODO: remove parent?

    }, {
        key: 'parallel',
        value: function parallel(parent) {
            var _this3 = this;

            for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
                args[_key4 - 1] = arguments[_key4];
            }

            //this.vLogger.log('parallel args:', args);

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('parallel args:', args, ', parent:', parent);
            }

            var pList = _.map(args, function (task) {
                return _this3._runPromiseTask(parent, task);
            });

            //this.vLogger.log('parallel pList:', pList);
            return when.all(pList);
        }
    }]);

    return Beelzebub;
}();

var BaseTasks = function () {
    function BaseTasks(config) {
        _classCallCheck(this, BaseTasks);

        this._processConfig(config);
        this.beelzebub = config.beelzebub || beelzebubInst;
        this.name = config.name || "BaseTasks";

        // TODO: use config function/util to process this

        this._rootLevel = false;
        this._defaultTaskFuncName = null;
        this._tasks = {};

        this._loadPromise = when.resolve();
        this._loading = false;
    }

    _createClass(BaseTasks, [{
        key: '_processConfig',
        value: function _processConfig(config) {
            this._config = _.merge(DefaultConfig, config || {});

            if (this._config.silent) {
                this.logger = nullLogger;
            } else {
                this.logger = this._config.logger;
            }

            this.vLogger = {
                log: function log() {},
                info: function info() {}
            };
            if (this._config.verbose) {
                this.vLogger = {
                    log: this.logger.log,
                    info: this.logger.info
                };
            }
        }
    }, {
        key: '$useAsRoot',
        value: function $useAsRoot() {
            this._rootLevel = true;
            this.name = "$root$";
        }
    }, {
        key: '$setDefault',
        value: function $setDefault(taskFuncName) {
            this._defaultTaskFuncName = taskFuncName;
        }
    }, {
        key: '$setName',
        value: function $setName(name) {
            this.name = name;
        }
    }, {
        key: '$getName',
        value: function $getName() {
            return this.name;
        }
    }, {
        key: '$getTasks',
        value: function $getTasks() {
            return this._tasks;
        }
    }, {
        key: '$getTask',
        value: function $getTask(name) {
            return this._tasks[name];
        }
    }, {
        key: '$init',
        value: function $init() {
            return null;
        }
    }, {
        key: '$isLoading',
        value: function $isLoading() {
            return this._loading;
        }
    }, {
        key: '$loading',
        value: function $loading() {
            return this._loadPromise;
        }
    }, {
        key: '$register',
        value: function $register($utils, $beelzebub) {
            var _this4 = this;

            var tList = [];

            this._bfsTaskBuilder(tList, this);

            // run init, running as optimal to shortcut $init's that don't return promises
            var result = this.beelzebub.normalizeExecFuncToPromise(this.$init, this, true);
            if (isPromise(result)) {
                this._loading = true;
                this._loadPromise = result.then(function (result) {
                    //this.vLogger.log('$register done loading init promise:', result);
                    _this4._loading = false;
                    return result;
                });
            } else {
                this._loading = false;
                this._loadPromise = null;
            }

            //this.vLogger.log('$register bfsTaskBuilder outList:', tList);
            this._addTasks(tList, this);
        }

        // TODO: combine the logic of 'add' and 'addSubTasks'

    }, {
        key: '$addSubTasks',
        value: function $addSubTasks(Task, config) {
            var task = null;
            if (_.isFunction(Task) && _.isObject(Task)) {
                task = new Task(config);

                // TODO: test if I need to register there
                //task.$register({}, this.beelzebub);
            } else {
                task = Task;
            }
            //this.vLogger.log('task:', task);

            var tList = [];
            this._bfsTaskBuilder(tList, task);
            //this.vLogger.log('subTasks bfsTaskBuilder outList:', tList);

            this._addTasks(tList, task);
        }
    }, {
        key: '_addTasks',
        value: function _addTasks(tList, task) {
            //this.vLogger.log('addTasksToGulp tList:', tList);

            _.forEach(tList, function (funcName) {
                var taskId = '';

                if (this != task && this.name) {
                    taskId = this.name + '.';
                }
                if (!this._rootLevel) {
                    taskId += task.name + '.';
                }
                taskId += funcName;

                if (funcName === this._defaultTaskFuncName) {
                    taskId = this.name; // set taskId to name of class
                }

                //this.vLogger.log('taskId:', taskId);
                this._tasks[taskId] = {
                    taskId: taskId,
                    tasksObj: task,
                    func: task[funcName]
                };
            }.bind(this));
        }
    }, {
        key: '_bfsTaskBuilder',
        value: function _bfsTaskBuilder(outList, task, name) {
            var proto = Object.getPrototypeOf(task);
            //this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

            if (proto && _.isObject(proto)) {

                //this.vLogger.log('name:', name, ', task.name:', task.name);
                name = name || task.name;
                var oproto = this._bfsTaskBuilder(outList, proto, name);
                if (Object.getPrototypeOf(oproto) && !(oproto === BaseTasks.prototype)) {
                    //this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BaseTasks:', (oproto === BaseTasks.prototype));

                    var tList = Object.getOwnPropertyNames(oproto);
                    tList = tList.filter(function (p) {
                        return _.isFunction(task[p]) && p !== 'constructor' /* NOT constructor */ && p[0] !== '_' /* doesn't start with underscore */ && p[0] !== '$' /* doesn't start with $ */
                        ;
                    }.bind(this));

                    //this.vLogger.log('name:', name, ', oproto:', oproto, ', tList:', tList);

                    for (var i = 0; i < tList.length; i++) {
                        outList.push(tList[i]);
                    }
                }
            }

            return task;
        }
    }, {
        key: '$sequance',
        value: function $sequance() {
            for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
                args[_key5] = arguments[_key5];
            }

            args.unshift(this);
            return this.beelzebub.sequance.apply(this.beelzebub, args);
        }
    }, {
        key: '$parallel',
        value: function $parallel() {
            for (var _len6 = arguments.length, args = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
                args[_key6] = arguments[_key6];
            }

            args.unshift(this);
            return this.beelzebub.parallel.apply(this.beelzebub, args);
        }
    }, {
        key: '$run',
        value: function $run() {
            for (var _len7 = arguments.length, args = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
                args[_key7] = arguments[_key7];
            }

            args.unshift(this);
            return this.beelzebub.run.apply(this.beelzebub, args);
        }
    }]);

    return BaseTasks;
}();

var BeelzebubMod = function BeelzebubMod(config) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub(config);
    }
    return beelzebubInst;
};

// TODO: find a better way to procedurlly create these functions
BeelzebubMod.create = function (config) {
    return new Beelzebub(config);
};
BeelzebubMod.init = function (config) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.init(config);
};
BeelzebubMod.add = function (task, config) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.add(task, config);
};
BeelzebubMod.sequance = function () {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }

    for (var _len8 = arguments.length, args = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
        args[_key8] = arguments[_key8];
    }

    return beelzebubInst.sequance.apply(beelzebubInst, args);
};
BeelzebubMod.parallel = function () {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }

    for (var _len9 = arguments.length, args = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
        args[_key9] = arguments[_key9];
    }

    return beelzebubInst.parallel.apply(beelzebubInst, args);
};
BeelzebubMod.run = function () {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }

    for (var _len10 = arguments.length, args = Array(_len10), _key10 = 0; _key10 < _len10; _key10++) {
        args[_key10] = arguments[_key10];
    }

    return beelzebubInst.run.apply(beelzebubInst, args);
};
BeelzebubMod.runCLI = function () {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }

    for (var _len11 = arguments.length, args = Array(_len11), _key11 = 0; _key11 < _len11; _key11++) {
        args[_key11] = arguments[_key11];
    }

    return beelzebubInst.runCLI.apply(beelzebubInst, args);
};

// classes
BeelzebubMod.Tasks = BaseTasks;
module.exports = BeelzebubMod;