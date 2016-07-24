'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _getOwnPropertyNames = require('babel-runtime/core-js/object/get-own-property-names');

var _getOwnPropertyNames2 = _interopRequireDefault(_getOwnPropertyNames);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
        (0, _classCallCheck3.default)(this, Beelzebub);

        this.reset();
        this.init(config);
    }

    (0, _createClass3.default)(Beelzebub, [{
        key: 'init',
        value: function init(config) {
            this._processConfig(config);
            this._rootTasks = new BaseTasks(this._config);
        }
    }, {
        key: 'reset',
        value: function reset() {
            // logger util
            // TODO: move this to util
            this.logger = console;
            // verbose logger
            // TODO: move over to stumpy
            this.vLogger = {
                log: function log() {},
                info: function info() {}
            };

            this._config = _.cloneDeep(DefaultConfig);
            this._rootTasks = null;
        }

        // TODO: unify the config loading from bz and the BaseTasks
        // TODO: use transfuser to merge configs/load files

    }, {
        key: '_processConfig',
        value: function _processConfig(config) {
            if (config.logger) {
                this.logger = config.logger;
            } else {
                this.logger = DefaultConfig.logger;
            }

            this._config = _.merge(DefaultConfig, config || {});

            if (this._config.silent) {
                this.logger = nullLogger;
            }
            this._config.logger = this.logger;

            if (this._config.verbose) {
                this.vLogger = {
                    log: this.logger.log,
                    info: this.logger.info
                };
            }
        }
    }, {
        key: 'getRunning',
        value: function getRunning() {
            return this._rootTasks.$getRunning();
        }
    }, {
        key: 'add',
        value: function add(Tasks, config) {

            var tasks = null;

            if (_.isString(Tasks)) {
                try {
                    // TODO: yanpm install this?
                    Tasks = require(Tasks);
                } catch (err) {
                    this.logger.error('Add Task Error:', err);
                    return;
                }
            }

            if (_.isFunction(Tasks) && _.isObject(Tasks)) {
                config = _.merge(this._config, config || {});
                config.beelzebub = this;

                tasks = new Tasks(config || this._config);

                if (!(tasks instanceof BaseTasks)) {
                    this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BaseTasks" -', tasks);
                    return;
                }
            } else if (_.isObject(Tasks) && Tasks instanceof BaseTasks) {
                tasks = Tasks;
            } else {
                this.logger.error('Add Task Error: Unknown Task type -', tasks);
                return;
            }

            if (tasks.$isRoot()) {

                // transfer all the current subTasks from old _rootTasks to current
                tasks.$setSubTask(this._rootTasks.$getSubTask());
                tasks.$register();

                this._rootTasks = tasks;
            } else {
                tasks.$register();
                this._rootTasks.$addSubTasks(tasks, config);
            }

            //this.vLogger.log( 'all tasks:', _.keys(this._rootTasks) );
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

            // TODO: ??? use transfuser to merge configs/load files
            // TODO: ??? merge with _processConfig
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
            for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
            }

            args.unshift(parent);
            // use internal function, because $run bounces back to root level
            return this._rootTasks._run.apply(this._rootTasks, args);
        }
    }, {
        key: 'sequance',
        value: function sequance(parent) {
            for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                args[_key3 - 1] = arguments[_key3];
            }

            args.unshift(parent);
            // use internal function, because $sequance bounces back to root level
            return this._rootTasks._sequance.apply(this._rootTasks, args);
        }
    }, {
        key: 'parallel',
        value: function parallel(parent) {
            for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
                args[_key4 - 1] = arguments[_key4];
            }

            args.unshift(parent);
            // use internal function, because $parallel bounces back to root level
            return this._rootTasks._parallel.apply(this._rootTasks, args);
        }
    }]);
    return Beelzebub;
}();

// TODO: ??? rename this to BzTasks


var BaseTasks = function () {
    function BaseTasks(config) {
        (0, _classCallCheck3.default)(this, BaseTasks);

        this._processConfig(config);
        this.beelzebub = config.beelzebub || beelzebubInst;
        this.name = config.name || "BaseTasks";

        // TODO: use config function/util to process this

        this._rootLevel = false;
        this._defaultTaskFuncName = null;
        this._tasks = {};
        this._subTasks = {};

        this._loadPromise = when.resolve();
        this._loading = false;
        this._running = null;
    }

    // TODO: unify the config loading from bz and the BaseTasks
    // TODO: use transfuser to merge configs/load files


    (0, _createClass3.default)(BaseTasks, [{
        key: '_processConfig',
        value: function _processConfig(config) {
            if (config.logger) {
                this.logger = config.logger;
            } else {
                this.logger = DefaultConfig.logger;
            }

            this._config = _.merge(DefaultConfig, config || {});

            if (this._config.silent) {
                this.logger = nullLogger;
            }
            this._config.logger = this.logger;

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
        key: '$isRoot',
        value: function $isRoot() {
            return this._rootLevel;
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
        key: '$getTask',
        value: function $getTask(name) {
            return this._tasks[name];
        }
    }, {
        key: '$getSubTask',
        value: function $getSubTask() {
            return this._subTasks;
        }
    }, {
        key: '$setSubTask',
        value: function $setSubTask(tasks) {
            this._subTasks = tasks;
        }
    }, {
        key: '$init',
        value: function $init() {
            return null;
        }
    }, {
        key: '$getRunning',
        value: function $getRunning() {
            return this._running;
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
        value: function $register() {
            var _this = this;

            var tList = [];

            this._bfsTaskBuilder(tList, this);

            // run init, running as optimal to shortcut $init's that don't return promises
            var result = this._normalizeExecFuncToPromise(this.$init, this, true);
            if (isPromise(result)) {
                this._loading = true;
                this._loadPromise = result.then(function (result) {
                    //this.vLogger.log('$register done loading init promise:', result);
                    _this._loading = false;
                    return result;
                });
            } else {
                this._loading = false;
                this._loadPromise = null;
            }

            //this.vLogger.log('$register bfsTaskBuilder outList:', tList);
            this._addTasks(tList, this);
        }
    }, {
        key: '_addTasks',
        value: function _addTasks(tList, task) {
            var _this2 = this;

            //this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', this != task:', this != task);

            _.forEach(tList, function (funcName) {
                var taskId = '';

                //if((this != task) && this.name) {
                //    taskId = this.name+'.';
                //}
                if (_this2 != task && !_this2._rootLevel) {
                    taskId += task.name + '.';
                }
                taskId += funcName;

                if (funcName === _this2._defaultTaskFuncName) {
                    taskId = 'default'; // set taskId to 'default'
                }

                //this.vLogger.log('taskId:', taskId);
                _this2._tasks[taskId] = {
                    taskId: taskId,
                    tasksObj: task,
                    func: task[funcName]
                };
            });
        }

        // TODO: ??? combine the logic of 'add' and 'addSubTasks'
        // move to recursive run model using task $register instead of mixing sub tasks with current task class

    }, {
        key: '$addSubTasks',
        value: function $addSubTasks(Task, config) {
            var task = null;
            if (_.isFunction(Task) && _.isObject(Task)) {
                task = new Task(config);

                task.$register();
            } else {
                task = Task;
            }

            //this.vLogger.log('task:', task);
            this._subTasks[task.$getName()] = task;

            //var tList = [];
            //this._bfsTaskBuilder(tList, task);
            //this.vLogger.log('subTasks bfsTaskBuilder outList:', tList);
            //this._addTasks(tList, task);
        }
    }, {
        key: '_normalizeExecFuncToPromise',
        value: function _normalizeExecFuncToPromise(func, parent, optimize) {
            var p = null;

            // func already a promise
            if (isPromise(func)) {
                p = func;
            }
            // func is a generator function
            else if (isGenerator(func)) {

                    // run generator using co
                    if (parent) {
                        p = co(func.bind(parent));
                    } else {
                        p = co(func);
                    }
                }
                // if task is function, run it
                else if (_.isFunction(func)) {
                        if (parent) {
                            p = func.apply(parent);
                        } else {
                            p = func();
                        }
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
    }, {
        key: '_bfsTaskBuilder',
        value: function _bfsTaskBuilder(outList, task, name) {
            var proto = (0, _getPrototypeOf2.default)(task);
            //this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

            if (proto && _.isObject(proto)) {

                //this.vLogger.log('name:', name, ', task.name:', task.name);
                name = name || task.name;
                var oproto = this._bfsTaskBuilder(outList, proto, name);
                if ((0, _getPrototypeOf2.default)(oproto) && !(oproto === BaseTasks.prototype)) {
                    //this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BaseTasks:', (oproto === BaseTasks.prototype));

                    var tList = (0, _getOwnPropertyNames2.default)(oproto);
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

        /**
         * Runs task(s) in sequance
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '$sequance',
        value: function $sequance() {
            var _beelzebub;

            // TODO: prevent infinite loop
            return (_beelzebub = this.beelzebub).sequance.apply(_beelzebub, arguments);
        }

        /**
         * Runs task(s) in parallel
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '$parallel',
        value: function $parallel() {
            var _beelzebub2;

            // TODO: prevent infinite loop
            return (_beelzebub2 = this.beelzebub).parallel.apply(_beelzebub2, arguments);
        }

        /**
         * Runs task(s) - multi args run in sequance, arrays are run in parallel
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '$run',
        value: function $run() {
            var _beelzebub3;

            // TODO: prevent infinite loop
            return (_beelzebub3 = this.beelzebub).run.apply(_beelzebub3, arguments);
        }

        /**
         * Internal Run task(s) in sequance
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '_sequance',
        value: function _sequance(parent) {
            var _this3 = this;

            for (var _len5 = arguments.length, args = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
                args[_key5 - 1] = arguments[_key5];
            }

            // this.vLogger.log('sequance args:', args);

            if (_.isFunction(parent) || !_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                // this.vLogger.log('sequance args:', args);
            }

            var aTasks = [];
            _.forEach(args, function (task) {
                aTasks.push(function () {
                    return _this3._runPromiseTask(parent, task);
                });
            });

            //this.vLogger.log('sequance args:', aTasks);
            return whenSequence(aTasks);
        }

        /**
         * Internal Runs task(s) in parallel
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '_parallel',
        value: function _parallel(parent) {
            var _this4 = this;

            for (var _len6 = arguments.length, args = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
                args[_key6 - 1] = arguments[_key6];
            }

            // this.vLogger.log('parallel args:', args);

            if (parent && !_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('parallel args:', args);
            }

            var pList = _.map(args, function (task) {
                return _this4._runPromiseTask(parent, task);
            });

            //this.vLogger.log('parallel pList:', pList);
            return when.all(pList);

            // args.unshift(this);
            // return this.beelzebub.parallel.apply(this.beelzebub, args);
        }

        /**
         * Runs task(s) - multi args run in sequance, arrays are run in parallel
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '_run',
        value: function _run(parent) {
            var _this5 = this;

            var taskName = 'default';
            var promise = null;

            // if(this._running) {
            //     this.logger.error('Already running a task:', this._running);
            //     return when.reject();
            // }

            for (var _len7 = arguments.length, args = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
                args[_key7 - 1] = arguments[_key7];
            }

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('run args:', args);
            }

            if (args.length === 1) {
                taskName = args[0];
                promise = this._runPromiseTask(parent, taskName);
            } else {
                // multi args mean, run in sequance
                promise = this._sequance.apply(this, args);
            }

            this._running = promise.then(function (result) {
                _this5._running = null;
                return result;
            });

            return this._running;
        }

        /**
         * run a task
         * @param task {String}
         * @returns {Promise}
         */
        // TODO: should this be private?

    }, {
        key: '_runTask',
        value: function _runTask(task) {
            var _this6 = this;

            var p = null;

            // wait for self to complete
            if (this.$isLoading() && isPromise(this.$loading())) {
                p = this.$loading();
            } else {
                p = when.resolve();
            }

            return p.then(function () {
                //this.vLogger.log( 'task class:', this.name, ', running task:', task, ', all tasks:', _.keys(this._tasks), ', all subTasks:', _.keys(this._subTasks) );

                // if no task specified, then use default
                if (!task || !task.length) {
                    task = 'default';
                }

                if (_.isString(task)) {
                    var taskParts = task.split('.');
                    var taskName = taskParts.shift();

                    if (_this6._subTasks[taskName]) {
                        return _this6._subTasks[taskName]._runTask(taskParts.join('.'));
                    } else if (_this6.$getTask(taskName)) {
                        var taskObj = _this6.$getTask(taskName);
                        return _this6._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj);
                    }
                    // Error ???
                }
                // what else could this be?
            });
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

    }, {
        key: '_runPromiseTask',
        value: function _runPromiseTask(parent, task) {
            var p = null;

            // if task is array, then run in parallel
            if (_.isArray(task)) {
                return this._parallel.apply(this, [parent].concat((0, _toConsumableArray3.default)(task)));
            }

            // if task is string, then find function and parent in list
            if (_.isString(task)) {
                var taskParts = task.split('.');
                var taskName = taskParts.shift();

                if (!this._tasks.hasOwnProperty(taskName)) {
                    // now check if in sub level
                    if (this._subTasks.hasOwnProperty(taskName)) {
                        p = this._subTasks[taskName]._runTask(taskParts.join('.'));
                        // this._subTasks[taskName].$getTask('default')
                        // p = this._subTasks[taskName]._runTask('default');
                    } else {
                        var error = 'task name not found: "' + task + '"';
                        this.logger.error(error);
                        p = when.reject(error);
                    }
                }

                if (!p) {
                    if (taskParts.length > 0) {
                        p = this._tasks[taskName]._runTask(taskParts.join('.'));
                    } else {
                        if (this._tasks[taskName]) {
                            task = this._tasks[taskName].func;
                            parent = this._tasks[taskName].tasksObj;

                            p = this._normalizeExecFuncToPromise(task, parent);
                        } else {
                            var _error = 'task name not found: "' + task + '"';
                            this.logger.error(_error);
                            p = when.reject(_error);
                        }
                    }
                }
            } else if (_.isFunction(task)) {
                // if(!parent) {
                //     parent = task;
                // }
                p = this._normalizeExecFuncToPromise(task, parent);
            } else {
                var _error2 = 'task type not supported: "' + task + '"';
                this.logger.trace(_error2);
                p = when.reject(_error2);
            }

            // TODO: not sure if this need, want to remove, infavor of _runTask in class
            //if(parent.$isLoading && parent.$isLoading()) {
            //    p = parent.$loading()
            //        .then( (result) => {
            //            //this.vLogger.log( 'runPromiseTask all tasks:', _.keys(this._tasks), ', result:', result );
            //            return this._normalizeExecFuncToPromise(task, parent);
            //        });
            //} else {
            //    p = this.normalizeExecFuncToPromise(task, parent);
            //}

            // TODO: what happens to the data at the end? TBD
            return p;
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

// TODO: find a better way to create these functions
BeelzebubMod.delete = function () {
    beelzebubInst = null;
};
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