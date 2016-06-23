'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _ = require('lodash');
var gulp = require('gulp');
var when = require('when');
var sequence = require('when/sequence');

var DefaultConfig = {
    verbose: false,
    silent: false,
    logger: console
};

// TODO: handle generators
// TODO: handle async/await
// TODO: pipe steams

// TODO: root level tasks?
// TODO: default task for the given task group

// TODO: change task functions to special names? or use decorators?

// TODO: gulp.util or general utils, like logging
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

var Beelzebub = (function () {
    function Beelzebub(config) {
        _classCallCheck(this, Beelzebub);

        this.init(config);
    }

    _createClass(Beelzebub, [{
        key: 'init',
        value: function init(config) {
            this._processConfig(config);

            this._tasks = {};
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

            task.$register({}, gulp, this);

            this._tasks = _.merge(this._tasks, task.$getTasks());
            //this.vLogger.log( task.$getName(), 'tasks:', task.$getTasks() );
            //this.vLogger.log( 'all tasks:', _.keys(this._tasks) );
        }
    }, {
        key: 'go',
        value: function go() {}
        // TODO: parse CLI input

        // should only be ran ONCE to kick off

    }, {
        key: 'run',
        value: function run(parent, taskName) {
            if (this._running != null) {
                this.logger.error('Already running a task:', this._running);
                return when.reject();
            }

            if (!taskName && _.isString(parent)) {
                taskName = parent;
            }

            if (taskName && _.isString(taskName) && !_.isArray(taskName)) {
                taskName = [taskName];
            }

            var deferer = when.defer();

            if (this._tasks && this._tasks.hasOwnProperty(taskName)) {
                this.vLogger.log('run!', taskName);
                this._running = taskName;

                gulp.start(taskName || 'default', (function (err) {
                    this._running = null;

                    if (err) {
                        deferer.reject({ error: err });
                        return;
                    }

                    this.vLogger.log('ran:', taskName[0], '- COMPLETE!');
                    deferer.resolve();
                }).bind(this));
            } else {
                this.logger.error('Task Run Error: "' + taskName + '" task does not exist!');
                deferer.reject();
            }

            return deferer.promise;
        }
    }, {
        key: 'sequance',
        value: function sequance(parent) {
            //this.vLogger.log('sequance args:', args);
            var aTasks = [];

            for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
            }

            _.forEach(args, (function (task) {
                aTasks.push((function () {
                    var p = when.resolve();

                    if (_.isString(task)) {
                        p = this._tasks[task].func.apply(this._tasks[task].tasksObj);
                    } else if (_.isFunction(task)) {
                        p = task.apply(parent);
                    }

                    // TODO: check other, steam?

                    return p;
                }).bind(this));
            }).bind(this));

            //this.vLogger.log('sequance args:', aTasks);
            return sequence(aTasks);
        }
    }, {
        key: 'parallel',
        value: function parallel(parent) {
            for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
            }

            //this.vLogger.log('parallel args:', args);

            var pList = _.map(args, (function (task) {
                var p = when.resolve();

                if (_.isString(task)) {
                    task = this._tasks[task];
                    p = task.func.apply(task.tasksObj);
                } else if (_.isFunction(task)) {
                    p = task.apply(parent);
                }

                // TODO: check other, steam?

                return p;
            }).bind(this));

            //this.vLogger.log('parallel pList:', pList);
            return when.all(pList);
        }
    }]);

    return Beelzebub;
})();

var BaseTasks = (function () {
    function BaseTasks(config) {
        _classCallCheck(this, BaseTasks);

        this._processConfig(config);
        this.beelzebub = config.beelzebub || beelzebubInst;
        this.name = config.name || "BaseTasks";

        // TODO: use config function/util to process this

        this._rootLevel = false;
        this._defaultTaskFuncName = null;
        this._tasks = {};
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
        key: '$register',
        value: function $register($utils, $gulp, $beelzebub) {

            var tList = [];
            this._bfsTaskBuilder(tList, this);

            //this.vLogger.log('$register bfsTaskBuilder outList:', tList);
            return this._addTasksToGulp(tList, this);
        }
    }, {
        key: '$addSubTasks',
        value: function $addSubTasks(Task, config) {
            var task = null;
            if (_.isFunction(Task) && _.isObject(Task)) {
                task = new Task(config);
            } else {
                task = Task;
            }
            //this.vLogger.log('task:', task);

            var tList = [];
            this._bfsTaskBuilder(tList, task);
            this.vLogger.log('subTasks bfsTaskBuilder outList:', tList);

            return this._addTasksToGulp(tList, task);
        }
    }, {
        key: '_addTasksToGulp',
        value: function _addTasksToGulp(tList, task) {
            this.vLogger.log('addTasksToGulp tList:', tList);

            _.forEach(tList, (function (funcName) {
                var taskId = '';

                if (this != task && this.name) {
                    taskId = this.name + '.';
                }
                if (!this._rootLevel) {
                    taskId += task.name + '.';
                }
                taskId += funcName;

                if (funcName === this._defaultTaskFuncName) {
                    taskId = 'default';
                }

                //this.vLogger.log('taskId:', taskId);

                this._tasks[taskId] = {
                    taskId: taskId,
                    tasksObj: task,
                    func: task[funcName]
                };

                gulp.task(taskId, (function (done) {
                    //this.vLogger.log('before task:', taskId);

                    //this.vLogger.log(funcName, '- start!');
                    var p = task[funcName].apply(task);

                    // TODO: proper check for promise
                    if (p && when.isPromiseLike(p)) {
                        p.then((function () {
                            //this.vLogger.log(funcName, '- promise done!');
                            done();
                        }).bind(this));
                    } else {
                        //this.vLogger.log(funcName, '- done!');
                        done();
                    }

                    //this.vLogger.log('after task:', taskId);
                }).bind(this));
            }).bind(this));
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
                    tList = tList.filter((function (p) {
                        return _.isFunction(task[p]) && p !== 'constructor' /* NOT constructor */ && p[0] !== '_' /* doesn't start with underscore */
                        ;
                    }).bind(this));

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
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
            }

            args.unshift(this);
            return this.beelzebub.sequance.apply(this.beelzebub, args);
        }
    }, {
        key: '$parallel',
        value: function $parallel() {
            for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                args[_key4] = arguments[_key4];
            }

            args.unshift(this);
            return this.beelzebub.parallel.apply(this.beelzebub, args);
        }
    }, {
        key: '$run',
        value: function $run() {
            for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
                args[_key5] = arguments[_key5];
            }

            args.unshift(this);
            return this.beelzebub.run.apply(this.beelzebub, args);
        }
    }]);

    return BaseTasks;
})();

var beelzebubInst = null;
var Beelzebubmod = function Beelzebubmod(config) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub(config);
    }
    return beelzebubInst;
};

// functions
Beelzebubmod.create = function (config) {
    return new Beelzebub(config);
};
Beelzebubmod.init = function (config) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.init(config);
};
Beelzebubmod.add = function (task, config) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.add(task, config);
};
Beelzebubmod.run = function (parent, taskName) {
    if (!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.run(parent, taskName);
};

// classes
Beelzebubmod.Tasks = BaseTasks;
module.exports = Beelzebubmod;