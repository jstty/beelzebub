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

            this._rootTasks = new BaseTasks(this._config);
            // this._rootTasks = {};
            // this._running = null;
        }
    }, {
        key: '_processConfig',
        value: function _processConfig(config) {
            // TODO: use transfuser to merge configs/load files
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
            this._rootTasks.$run.apply(this._rootTasks, args);
        }
    }, {
        key: 'sequance',
        value: function sequance(parent) {
            for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                args[_key3 - 1] = arguments[_key3];
            }

            args.unshift(parent);
            this._rootTasks.$sequance.apply(this._rootTasks, args);
        }
    }, {
        key: 'parallel',
        value: function parallel(parent) {
            for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
                args[_key4 - 1] = arguments[_key4];
            }

            args.unshift(parent);
            this._rootTasks.$parallel.apply(this._rootTasks, args);
        }
    }]);

    return Beelzebub;
}();

// TODO: ??? rename this to BzTasks


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
        this._subTasks = {};

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

        /**
         * run a task
         * @param task {String}
         * @returns {Promise}
         */

    }, {
        key: '$runTask',
        value: function $runTask(task) {
            var _this3 = this;

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

                    if (_this3._subTasks[taskName]) {
                        return _this3._subTasks[taskName].$runTask(taskParts.join('.'));
                    } else if (_this3.$getTask(taskName)) {
                        var taskObj = _this3.$getTask(taskName);
                        return _this3._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj);
                    }
                    // Error ???
                }
                // what else could this be?
            });
        }

        /**
         * Runs task(s) in sequance
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '$sequance',
        value: function $sequance(parent) {
            var _this4 = this;

            for (var _len5 = arguments.length, args = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
                args[_key5 - 1] = arguments[_key5];
            }

            //this.vLogger.log('sequance args:', args);

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('sequance args:', args);
            }

            var aTasks = [];
            _.forEach(args, function (task) {
                aTasks.push(function () {
                    return _this4._runPromiseTask(parent, task);
                });
            });

            //this.vLogger.log('sequance args:', aTasks);
            return whenSequence(aTasks);
        }

        /**
         * Runs task(s) in parallel
         * @param task(s) (function or string)
         * @returns {Promise}
         */

    }, {
        key: '$parallel',
        value: function $parallel(parent) {
            var _this5 = this;

            for (var _len6 = arguments.length, args = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
                args[_key6 - 1] = arguments[_key6];
            }

            //this.vLogger.log('parallel args:', args);

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('parallel args:', args);
            }

            var pList = _.map(args, function (task) {
                return _this5._runPromiseTask(parent, task);
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
        key: '$run',
        value: function $run(parent) {
            var _this6 = this;

            var taskName = 'default';
            var promise = null;

            if (this._running) {
                this.logger.error('Already running a task:', this._running);
                return when.reject();
            }

            for (var _len7 = arguments.length, args = Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
                args[_key7 - 1] = arguments[_key7];
            }

            if (!_.isObject(parent)) {
                args.unshift(parent);
                parent = undefined;
                //this.vLogger.log('run args:', args);
            }

            this._running = true;

            if (args.length === 1) {
                taskName = args[0];
                promise = this._runPromiseTask(parent, taskName);
            } else {
                // multi args mean, run in sequance
                promise = this.$sequance.apply(this, args);
            }

            return promise.then(function (result) {
                _this6._running = false;
                return result;
            });
        }

        /**
         * Runs task
         * @param parent object
         * @param task (function or string)
         * @returns {Promise}
         */
        // TODO: can we merge this with runTask?
        // so it can recursivly chain down to resolve promises all the way down

    }, {
        key: '_runPromiseTask',
        value: function _runPromiseTask(parent, task) {
            var p = null;

            // if task is array, then run in parallel
            if (_.isArray(task)) {
                return this.$parallel.apply(this, [parent].concat(_toConsumableArray(task)));
            }

            // if task is string, then find function and parent in list
            if (_.isString(task)) {
                var taskParts = task.split('.');
                var taskName = taskParts.shift();

                if (!this._tasks.hasOwnProperty(taskName)) {
                    // now check if in sub level
                    if (this._subTasks.hasOwnProperty(taskName)) {
                        p = this._subTasks[taskName].$runTask(taskParts.join('.'));
                        // this._subTasks[taskName].$getTask('default')
                        // p = this._subTasks[taskName].$runTask('default');
                    } else {
                        p = when.reject('task name not found: "' + task + '"');
                    }
                }

                if (!p) {
                    if (taskParts.length > 0) {
                        p = this._tasks[taskName].$runTask(taskParts.join('.'));
                    } else {
                        if (this._tasks[taskName]) {
                            task = this._tasks[taskName].func;
                            parent = this._tasks[taskName].tasksObj;

                            p = this._normalizeExecFuncToPromise(task, parent);
                        } else {
                            p = when.reject('task name not found: "' + task + '"');
                        }
                    }
                }
            }

            // TODO: not sure if this need, want to remove, infavor of $runTask in class
            //if(parent.$isLoading && parent.$isLoading()) {
            //    p = parent.$loading()
            //        .then( (result) => {
            //            //this.vLogger.log( 'runPromiseTask all tasks:', _.keys(this._tasks), ', result:', result );
            //            return this.normalizeExecFuncToPromise(task, parent);
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