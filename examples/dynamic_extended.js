const _ = require('lodash');

const Beelzebub = require('../');
Beelzebub({
    verbose: true
});

class MyBaseTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName(config.name || "MyBaseTasks");

        this.value = config.value;
        this._delayTime = config.delayTime || 2000;
    }

    // TODO: why is this being added to the tasks?
    $init() {
        return this._delay(this.name + ' init', 500);
    }

    _delay(message, delay) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.info(message);
                resolve();
            }, delay || this._delayTime);
        });
    }

    task1() {
        return this._delay('MyBaseTasks task1 - ' + this.value);
    }
}

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");
    }

    $init() {
        // simlate tasks dynamiclly added after some async event
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.$addSubTasks( MyBaseTasks, { name: 'MyBaseTasks1', value: 123 } );
                this.$addSubTasks( MyBaseTasks, { name: 'MyBaseTasks2', value: 456, delayTime: 100000 } );
                // done
                resolve(1234);
            }, 2000);
        });
    }

    task1() {
        this.logger.log('MyTasks task1');
        return this.$sequance('MyTasks.MyBaseTasks1.task1', 'MyTasks.MyBaseTasks2.task1');
    }
}

Beelzebub.add( MyTasks );

Beelzebub.run('MyTasks.MyBaseTasks1.task1');

module.exports = MyTasks;
