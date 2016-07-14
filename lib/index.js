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
}

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
        this.init(config);
    }

    init(config){
        this._processConfig(config);

        this._rootTasks = {};
        this._running = null;
    }

    _processConfig(config){
        this._config = _.merge(DefaultConfig, config || {});

        if(this._config.silent) {
            this.logger = nullLogger;
        } else {
            this.logger = this._config.logger;
        }


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

    add(Task, config) {
        var task = null;

        if ( _.isString(Task) ) {
            try {
                // TODO: yanpm install this?
                Task = require(Task);
            }
            catch(err){
                this.logger.error('Add Task Error:', err);
                return;
            }
        }

        if ( _.isFunction(Task) && _.isObject(Task) ) {
            config = _.merge(this._config, config || {});
            config.beelzebub = this;

            task = new Task(config || this._config);

            if(!(task instanceof BaseTasks)) {
                this.logger.error('Add Task Error: Invalid Class/prototype needs to be of type "Beelzebub.BaseTasks" -', task);
                return;
            }
        }
        else if ( _.isObject(Task) && (Task instanceof BaseTasks) ) {
            task = Task;
        }
        else {
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

    normalizeExecFuncToPromise(func, parent, optimize) {
        let p = null;

        // func already a promise
        if(isPromise(func)) {
            p = func;
        }
        // func is a generator function
        else if(isGenerator(func)) {
            // run generator using co
            p = co( func.bind(parent) );
        }
        // if task is function, run it
        else if( _.isFunction(func) ) {
            p = func.apply(parent);
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


    /**
     * Runs task
     * @param parent object
     * @param task (function or string)
     * @returns {Promise}
     */
    _runPromiseTask(parent, task) {

        // if task is array, then run in parrallel
        if( _.isArray(task) ) {
            return this.parallel(...task);
        }

        // if task is string, then find function and parent in list
        if( _.isString(task) ) {
            let taskParts = task.split('.');
            let taskName = taskParts[0];

            if( !this._rootTasks.hasOwnProperty(taskName) ) {
                // now check root level
                taskName = '$root$';
                if( !this._rootTasks.hasOwnProperty(taskName) || !this._rootTasks[taskName].$getTask(task) ) {
                    return when.reject('task name not found: "' + taskName+ '"');
                }
            }

            let taskObj = this._rootTasks[taskName].$getTask(task);
            task   = taskObj.func;
            parent = taskObj.tasksObj;
        }

        let p = null;
        if(parent.$isLoading && parent.$isLoading()) {
            p = parent.$loading()
                .then( (result) => {
                    //this.vLogger.log( 'runPromiseTask all tasks:', _.keys(this._tasks), ', result:', result );
                    return this.normalizeExecFuncToPromise(task, parent);
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
    runCLI(...args) {

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
        let taskName = 'default';

        if(this._running != null) {
            this.logger.error('Already running a task:', this._running);
            return when.reject();
        }

        if(!_.isObject(parent)) {
            args.unshift(parent);
            parent = undefined;
            //this.vLogger.log('sequance args:', args, ', parent:', parent);
        }

        if(args.length === 0) {
            taskName = args[0];
        } else {
            // multi args mean, run in sequance
            return this.sequance(...args);
        }

        return this._runPromiseTask(parent, taskName);
    }

    // TODO: remove parent?
    sequance(parent, ...args) {
        //this.vLogger.log('sequance args:', args);
        var aTasks = [];

        if(!_.isObject(parent)) {
            args.unshift(parent);
            parent = undefined;
            //this.vLogger.log('sequance args:', args, ', parent:', parent);
        }

        _.forEach(args, (task) => {
            aTasks.push( () => {
                return this._runPromiseTask(parent, task);
            });
        });

        //this.vLogger.log('sequance args:', aTasks);
        return whenSequence(aTasks);
    }

    // TODO: remove parent?
    parallel(parent, ...args) {
        //this.vLogger.log('parallel args:', args);

        if(!_.isObject(parent)) {
            args.unshift(parent);
            parent = undefined;
            //this.vLogger.log('parallel args:', args, ', parent:', parent);
        }

        var pList = _.map(args, (task) => {
            return this._runPromiseTask(parent, task);
        });

        //this.vLogger.log('parallel pList:', pList);
        return when.all(pList);
    }
}

class BaseTasks {
    constructor(config) {
        this._processConfig(config);
        this.beelzebub   = config.beelzebub || beelzebubInst;
        this.name   = config.name || "BaseTasks";

        // TODO: use config function/util to process this

        this._rootLevel = false;
        this._defaultTaskFuncName = null;
        this._tasks = {};

        this._loadPromise = when.resolve();
        this._loading = false;
    }

    _processConfig(config){
        this._config = _.merge(DefaultConfig, config || {});

        if(this._config.silent) {
            this.logger = nullLogger;
        } else {
            this.logger = this._config.logger;
        }


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

    $setName(name){
        this.name = name;
    }

    $getName(){
        return this.name;
    }

    $getTasks() {
        return this._tasks;
    }

    $getTask(name) {
        return this._tasks[name];
    }

    $init() {
        return null;
    }

    $isLoading() {
        return this._loading;
    }

    $loading() {
        return this._loadPromise;
    }

    $register($utils, $beelzebub) {
        let tList = [];

        this._bfsTaskBuilder(tList, this);

        // run init, running as optimal to shortcut $init's that don't return promises
        let result = this.beelzebub.normalizeExecFuncToPromise(this.$init, this, true);
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

    // TODO: combine the logic of 'add' and 'addSubTasks'
    $addSubTasks(Task, config) {
        var task = null;
        if ( _.isFunction(Task) && _.isObject(Task) ){
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

    _addTasks(tList, task) {
         //this.vLogger.log('addTasksToGulp tList:', tList);

        _.forEach(tList, function(funcName) {
            var taskId = '';

            if((this != task) && this.name) {
                taskId = this.name+'.';
            }
            if(!this._rootLevel) {
                taskId += task.name+'.';
            }
            taskId += funcName;

            if(funcName === this._defaultTaskFuncName) {
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

    $sequance(...args){
        args.unshift(this);
        return this.beelzebub.sequance.apply(this.beelzebub, args);
    }

    $parallel(...args){
        args.unshift(this);
        return this.beelzebub.parallel.apply(this.beelzebub, args);
    }

    $run(...args) {
        args.unshift(this);
        return this.beelzebub.run.apply(this.beelzebub, args);
    }
}


var BeelzebubMod = function(config){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub(config);
    }
    return beelzebubInst;
};

// TODO: find a better way to procedurlly create these functions
BeelzebubMod.create = function(config){
    return new Beelzebub(config);
}
BeelzebubMod.init = function(config){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.init(config);
}
BeelzebubMod.add = function(task, config){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.add(task, config);
}
BeelzebubMod.sequance = function(...args){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.sequance.apply(beelzebubInst, args);
}
BeelzebubMod.parallel = function(...args){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.parallel.apply(beelzebubInst, args);
}
BeelzebubMod.run = function(...args){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.run.apply(beelzebubInst, args);
}
BeelzebubMod.runCLI = function(...args){
    if(!beelzebubInst) {
        beelzebubInst = new Beelzebub();
    }
    return beelzebubInst.runCLI.apply(beelzebubInst, args);
}


// classes
BeelzebubMod.Tasks = BaseTasks;
module.exports = BeelzebubMod;
