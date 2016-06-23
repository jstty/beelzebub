var Beelzebub = require('../');
Beelzebub({
    verbose: true
});

class MyBaseTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyBaseTasks");
    }

    task1(){
        this.logger.log('MyBaseTasks task1');
    }

    task2(){
        this.logger.log('MyBaseTasks task2');
    }

    _internalFunction(){
        this.logger.error('this should be ignored');
    }
}
Beelzebub.add( MyBaseTasks );

class MyTasks extends MyBaseTasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");
    }

    task1() {
        this.logger.log('MyTasks task1');
    }

    task3(){
        this.logger.log('MyTasks task3');
    }
}
Beelzebub.add( MyTasks );

console.log('-------------------------');
Beelzebub.run('MyTasks.task1');

// 5 seconds later run task2
setTimeout(() => {
  Beelzebub.run('MyTasks.task3');

  // 5 seconds later run task2
  setTimeout(() => {
    Beelzebub.run('MyTasks.task2');
  }, 5000);
}, 5000);
