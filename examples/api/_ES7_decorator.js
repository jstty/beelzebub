'use strict'

var Beelzebub = require('../../');
Beelzebub({
    verbose: true
});

function defaultTask (target) {
    target.isTestable = true;
}

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");
    }

    @defaultTask
    task1(){
        this.logger.log('MyTasks task1');
    }

    task2(){
        this.logger.log('MyTasks task2');
    }

    _internalFunction(){
        this.logger.error('this should be ignored');
    }
}
Beelzebub.add( MyTasks );

console.log('-------------------------');
Beelzebub.run('MyTasks.task1', 'MyTasks.task2');
