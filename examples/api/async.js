'use strict';
// !-- FOR TESTS
let wrapper = function(options) {
// --!


// =====================================================
let Beelzebub = require('../../');
let bz = Beelzebub(options || { verbose: true });

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");

        this._delayTime = 200;
    }

    _delay(message, delay) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.log(message);
                resolve();
            }, delay);
        });
    }

    /**
     * Promise based task
     */
    task1() {
        this.logger.log('MyTasks task1: before');
        return this._delay('MyTasks task1: promise delay '+this._delayTime, this._delayTime)
        .then(() => {
            this.logger.log('MyTasks task1: after');
        });
    }

    /**
     * generator based tasks
     */
    * task2() {
        let delay = this._delayTime + 100;
        this.logger.log('MyTasks task2: before');
        yield this._delay('MyTasks task2: yield delay '+delay, delay);
        this.logger.log('MyTasks task2: after');
    }

    /**
     * async/await based task
     */
    //async task3() {
    //    this.logger.log('MyTasks task3: before');
    //    await this._delay('MyTasks task3: await delay'+this._delayTime);
    //    this.logger.log('MyTasks task3: after');
    //}
}
bz.add( MyTasks );

bz.run( // all args run in sequance
    'MyTasks.task1',
    'MyTasks.task2',
    //'MyTasks.task3',
    [ // arrays run in parallel
        'MyTasks.task1',
        'MyTasks.task2'
        //, 'MyTasks.task3'
    ]
);
// =====================================================


// !-- FOR TESTS
return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if(typeof global.it !== 'function') wrapper();
// --!