const _    = require('lodash');
const co   = require('co');
const streamToPromise = require('stream-to-promise');

// TODO: replace ???
const when = require('when');
const whenSequence = require('when/sequence');

// internal singleton instance of the class, only created when needed
var beelzebubInst = null;

const DefaultConfig = {
    verbose: false,
    silent: false,
    logger: console
};

const nullLogger = {
    log: function(){},
    warn: function(){},
    info: function(){},
    error: function(){},
    trace: function(){},

    clear: function(){},
    count: function(){},
    debug: function(){},
    dir: function(){},
    dirxml: function(){},
    group: function(){},
    groupCollapsed: function(){},
    groupEnd: function(){},
    profile: function(){},
    profileEnd: function(){},
    time: function(){},
    timeEnd: function(){},
    timeStamp: function(){}
};

/**
 * check if function is generator
 * @param function
 * @returns {boolean}
 */
function isGenerator(func) {
    return (func &&
            func.constructor &&
            func.constructor.name === 'GeneratorFunction');
}

/**
 * check if function is promise
 * @param Promise
 * @returns {boolean}
 */
function isPromise(p) {
    return ( p && _.isObject(p) && _.isFunction(p.then) );
}

/**
 * check if function is stream
 * @param stream
 * @returns {boolean}
 */
function isStream(s) {
    return ( s && _.isObject(s) && _.isFunction(s.pipe) );
}

/** ******************************************************
 * Beelzebub Class
 ****************************************************** */
class Beelzebub {
    constructor(config) {
        this.reset();
        this.init(config);
    }

    init(config){
        this._processConfig(config);
        this._rootTasks = new BaseTasks(this._config);
    }

    reset() {
        // logger util
        // TODO: move this to util
        this.logger = console;
        // verbose logger
        // TODO: move over to stumpy
        this.vLogger = {
            log:  function(){},
            info: function(){}
        };

        this._config = _.cloneDeep(DefaultConfig);
        this._rootTasks = null;
    }

    // TODO: unify the config loading from bz and the BaseTasks
    // TODO: use transfuser to merge configs/load files
    _processConfig(config) {
        if(config.logger) {
            this.logger = config.logger;
        } else {
            this.logger = DefaultConfig.logger;
        }

        this._config = _.merge(DefaultConfig, config || {});

        if(this._config.silent) {
            this.logger = nullLogger;
        }
        this._config.logger = this.logger;

        if(this._config.verbose) {
            this.vLogger = {
                log:  this.logger.log,
                info: this.logger.info
            };
        }
    }

    getRunning() {
        return this._rootTasks.$getRunning();
    }

    add(Tasks, config) {

        var tasks = null;

        if ( _.isString(Tasks) ) {
            try {
                // TODO: yanpm install this?
                Tasks = require(Tasks);
            }
            catch(err){
                this.logger.error('Add Task Error:', err);
                return;
            }
        }

        if ( _.isFunction(Tasks) && _.isObject(Tasks) ) {
            config = _.merge(this._config, config || {});
            config.beelzebub = this;

            tasks = new Tasks(config || this._config);

            if(!(tasks instanceof BaseTasks)) {
                this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BaseTasks" -', tasks);
                return;
            }
        }
        else if ( _.isObject(Tasks) && (Tasks instanceof BaseTasks) ) {
            tasks = Tasks;
        }
        else {
            this.logger.error('Add Task Error: Unknown Task type -', tasks);
            return;
        }

        if(tasks.$isRoot()) {

            // transfer all the current subTasks from old _rootTasks to current
            tasks.$setSubTask( this._rootTasks.$getSubTask() );
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
    runCLI(...args) {
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
    run(parent, ...args) {
        args.unshift(parent);
        // use internal function, because $run bounces back to root level
        return this._rootTasks._run.apply(this._rootTasks, args);
    }

    sequance(parent, ...args) {
        args.unshift(parent);
        // use internal function, because $sequance bounces back to root level
        return this._rootTasks._sequance.apply(this._rootTasks, args);
    }

    parallel(parent, ...args) {
        args.unshift(parent);
        // use internal function, because $parallel bounces back to root level
        return this._rootTasks._parallel.apply(this._rootTasks, args);
    }

}

// TODO: ??? rename this to BzTasks
class BaseTasks {
    constructor(config) {
        this._processConfig(config);
        this.beelzebub   = config.beelzebub || beelzebubInst;
        this.name   = config.name || "BaseTasks";

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
    _processConfig(config) {
        if(config.logger) {
            this.logger = config.logger;
        } else {
            this.logger = DefaultConfig.logger;
        }

        this._config = _.merge(DefaultConfig, config || {});

        if(this._config.silent) {
            this.logger = nullLogger;
        }
        this._config.logger = this.logger;

        this.vLogger = {
            log:  function(){},
            info: function(){}
        };
        if(this._config.verbose){
            this.vLogger = {
                log:  this.logger.log,
                info: this.logger.info
            };
        }
    }

    $useAsRoot() {
        this._rootLevel = true;
        this.name = "$root$";
    }

    $setDefault(taskFuncName){
        this._defaultTaskFuncName = taskFuncName;
    }

    $isRoot() {
        return this._rootLevel;
    }

    $setName(name){
        this.name = name;
    }

    $getName(){
        return this.name;
    }

    $getTask(name) {
        return this._tasks[name];
    }

    $getSubTask() {
        return this._subTasks;
    }

    $setSubTask(tasks) {
        this._subTasks = tasks;
    }

    $init() {
        return null;
    }

    $getRunning() {
        return this._running;
    }

    $isLoading() {
        return this._loading;
    }

    $loading() {
        return this._loadPromise;
    }

    $register() {
        let tList = [];

        this._bfsTaskBuilder(tList, this);

        // run init, running as optimal to shortcut $init's that don't return promises
        let result = this._normalizeExecFuncToPromise(this.$init, this, true);
        if( isPromise(result) ) {
            this._loading = true;
            this._loadPromise = result.then( (result) => {
                //this.vLogger.log('$register done loading init promise:', result);
                this._loading = false;
                return result;
            } );
        } else {
            this._loading = false;
            this._loadPromise = null;
        }

        //this.vLogger.log('$register bfsTaskBuilder outList:', tList);
        this._addTasks(tList, this);
    }

    _addTasks(tList, task) {
        //this.vLogger.log('addTasksToGulp tList:', tList, ', name:', this.name, ', this != task:', this != task);

        _.forEach(tList, (funcName) => {
            var taskId = '';

            //if((this != task) && this.name) {
            //    taskId = this.name+'.';
            //}
            if(
                (this != task) &&
                !this._rootLevel
            ) {
                taskId += task.name+'.';
            }
            taskId += funcName;

            if(funcName === this._defaultTaskFuncName) {
                taskId = 'default'; // set taskId to 'default'
            }

            //this.vLogger.log('taskId:', taskId);
            this._tasks[taskId] = {
                taskId: taskId,
                tasksObj: task,
                func: task[funcName]
            };
        } );
    }

    // TODO: ??? combine the logic of 'add' and 'addSubTasks'
    // move to recursive run model using task $register instead of mixing sub tasks with current task class
    $addSubTasks(Task, config) {
        var task = null;
        if ( _.isFunction(Task) && _.isObject(Task) ){
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

    _normalizeExecFuncToPromise(func, parent, optimize) {
        let p = null;

        // func already a promise
        if(isPromise(func)) {
            p = func;
        }
        // func is a generator function
        else if(isGenerator(func)) {

            // run generator using co
            if(parent) {
                p = co( func.bind(parent) );
            } else {
                p = co( func );
            }
        }
        // if task is function, run it
        else if( _.isFunction(func) ) {
            if(parent) {
                p = func.apply(parent);
            } else {
                p = func();
            }
        } else {
            // TODO: check other
            this.logger.warn('other type?? task:', task, ', parent:', parent);
        }

        // convert streams to promise
        if( isStream(p) ) {
            p = streamToPromise(p);
        }

        if( !optimize && !isPromise(p) ) {
            p = when.resolve(p);
        }

        return p;
    }


    _bfsTaskBuilder(outList, task, name) {
        var proto = Object.getPrototypeOf(task);
        //this.vLogger.log('task:', task, ', proto:', proto, ', name:', name);

        if(proto && _.isObject(proto)){

            //this.vLogger.log('name:', name, ', task.name:', task.name);
            name = name || task.name;
            var oproto = this._bfsTaskBuilder(outList, proto, name);
            if( Object.getPrototypeOf(oproto) && !(oproto === BaseTasks.prototype) ) {
                //this.vLogger.log('name:', name, 'oproto:', oproto, ', oproto instanceof BaseTasks:', (oproto === BaseTasks.prototype));

                var tList = Object.getOwnPropertyNames(oproto);
                tList = tList.filter(function (p) {
                    return (
                        _.isFunction(task[p]) &&
                        (p !== 'constructor') /* NOT constructor */ &&
                        (p[0] !== '_')        /* doesn't start with underscore */ &&
                        (p[0] !== '$')        /* doesn't start with $ */
                    );
                }.bind(this) );

                //this.vLogger.log('name:', name, ', oproto:', oproto, ', tList:', tList);

                for(var i = 0; i < tList.length; i++){
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
    $sequance(...args) {
        // TODO: prevent infinite loop
        return this.beelzebub.sequance(...args);
    }

    /**
     * Runs task(s) in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */
    $parallel(...args) {
        // TODO: prevent infinite loop
        return this.beelzebub.parallel(...args);
    }

    /**
     * Runs task(s) - multi args run in sequance, arrays are run in parallel
     * @param task(s) (function or string)
     * @returns {Promise}
     */
    $run(...args) {
        // TODO: prevent infinite loop
        return this.beelzebub.run(...args);
    }


    /**
     * Internal Run task(s) in sequance
     * @param task(s) (function or string)
     * @returns {Promise}
     */
    _sequance(parent, ...args) {
        // this.vLogger.log('sequance args:', args);

        if(_.isFunction(parent) || !_.isObject(parent)) {
            args.unshift(parent);
            parent = undefined;
            // this.vLogger.log('sequance args:', args);
        }

        let aTasks = [];
        _.forEach(args, (task) => {
            aTasks.push( () => {
                return this._runPromiseTask(parent, task);
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
    _parallel(parent, ...args) {
        // this.vLogger.log('parallel args:', args);

        if(parent && !_.isObject(parent)) {
            args.unshift(parent);
            parent = undefined;
            //this.vLogger.log('parallel args:', args);
        }

        var pList = _.map(args, (task) => {
            return this._runPromiseTask(parent, task);
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
    _run(parent, ...args) {
        let taskName = 'default';
        let promise = null;

        // if(this._running) {
        //     this.logger.error('Already running a task:', this._running);
        //     return when.reject();
        // }

        if(!_.isObject(parent)) {
            args.unshift(parent);
            parent = undefined;
            //this.vLogger.log('run args:', args);
        }

        if(args.length === 1) {
            taskName = args[0];
            promise = this._runPromiseTask(parent, taskName);
        } else {
            // multi args mean, run in sequance
            promise = this._sequance(...args);
        }

        this._running = promise.then( (result) => {
            this._running = null;
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
    _runTask(task) {
        let p = null;

        // wait for self to complete
        if(this.$isLoading() && isPromise(this.$loading())) {
            p = this.$loading();
        } else {
            p = when.resolve();
        }

        return p.then( () => {
            //this.vLogger.log( 'task class:', this.name, ', running task:', task, ', all tasks:', _.keys(this._tasks), ', all subTasks:', _.keys(this._subTasks) );

            // if no task specified, then use default
            if(!task || !task.length) {
                task = 'default';
            }

            if( _.isString(task) ) {
                let taskParts = task.split('.');
                let taskName = taskParts.shift();

                if( this._subTasks[taskName] ) {
                    return this._subTasks[taskName]._runTask(taskParts.join('.'));
                }
                else if( this.$getTask(taskName) ) {
                    let taskObj = this.$getTask(taskName);
                    return this._normalizeExecFuncToPromise(taskObj.func, taskObj.tasksObj);
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
    _runPromiseTask(parent, task) {
        let p = null;

        // if task is array, then run in parallel
        if( _.isArray(task) ) {
            return this._parallel(parent, ...task);
        }

        // if task is string, then find function and parent in list
        if( _.isString(task) ) {
            let taskParts = task.split('.');
            let taskName = taskParts.shift();

            if( !this._tasks.hasOwnProperty(taskName) ) {
                // now check if in sub level
                if( this._subTasks.hasOwnProperty(taskName) ) {
                    p = this._subTasks[taskName]._runTask(taskParts.join('.'));
                    // this._subTasks[taskName].$getTask('default')
                    // p = this._subTasks[taskName]._runTask('default');
                } else {
                    let error = 'task name not found: "' + task+ '"';
                    this.logger.error(error);
                    p = when.reject(error);
                }
            }

            if(!p) {
                if(taskParts.length > 0) {
                    p = this._tasks[taskName]._runTask(taskParts.join('.'));
                } else {
                    if(this._tasks[taskName]) {
                        task   = this._tasks[taskName].func;
                        parent = this._tasks[taskName].tasksObj;

                        p = this._normalizeExecFuncToPromise(task, parent);
                    } else {
                        let error = 'task name not found: "' + task+ '"';
                        this.logger.error(error);
                        p = when.reject(error);
                    }
                }
            }
        }
        else if( _.isFunction(task) ) {
            // if(!parent) {
            //     parent = task;
            // }
            p = this._normalizeExecFuncToPromise(task, parent);
        }
        else {
            let error = 'task type not supported: "' + task+ '"';
            this.logger.trace(error);
            p = when.reject(error);
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
}


var BeelzebubMod = function(config) {
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub(config);
    }
    return beelzebubInst;
};

// TODO: find a better way to create these functions
BeelzebubMod.delete = function() {
    beelzebubInst = null;
};
BeelzebubMod.create = function(config) {
    return new Beelzebub(config);
};
BeelzebubMod.init = function(config){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.init(config);
};
BeelzebubMod.add = function(task, config) {
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.add(task, config);
};
BeelzebubMod.sequance = function(...args) {
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.sequance.apply(beelzebubInst, args);
}
BeelzebubMod.parallel = function(...args) {
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.parallel.apply(beelzebubInst, args);
};
BeelzebubMod.run = function(...args) {
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.run.apply(beelzebubInst, args);
};
BeelzebubMod.runCLI = function(...args) {
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.runCLI.apply(beelzebubInst, args);
};


// classes
BeelzebubMod.Tasks = BaseTasks;
module.exports = BeelzebubMod;
