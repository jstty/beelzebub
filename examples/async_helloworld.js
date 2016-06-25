var Beelzebub = require('../');
Beelzebub({
    verbose: true
});

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");

        this._delayTime = 1000;
    }

    _delay(message) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.info(message);
                resolve();
            }, this._delayTime);
        });
    }

    /**
     * Promise based task
     */
    task1() {
        this.logger.log('MyTasks task1: before');

        return this._delay('MyTasks task1: promise delay '+this._delayTime)
        .then(() => {
            this.logger.log('MyTasks task1: after');
        });
    }

    /**
     * generator based tasks
     */
    * task2() {
        this.logger.log('MyTasks task2: before');
        yield this._delay('MyTasks task2: yield delay '+this._delayTime);
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
Beelzebub.add( MyTasks );


console.log('-------------------------');


Beelzebub.run( // all args run in sequance
    'MyTasks.task1',
    'MyTasks.task2',
    //'MyTasks.task3',
    [ // arrays run in parallel
        'MyTasks.task1',
        'MyTasks.task2'
        //, 'MyTasks.task3'
    ]
);
