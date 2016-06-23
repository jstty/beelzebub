var Beelzebub = require('../');
Beelzebub({
    verbose: true
});

//var Beelzebub = Beelzebub.create({
//    //verbose: true
//});

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


class SuperTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("SuperTasks");

        this.maxCount = 2;

        this.$addSubTasks( MyTasks, {
            // config
        } );
    }

    task1() {
        var count = 0;
        return new Promise(function(resolve, reject) {
            var timer = setInterval(function () {
                count++;
                if (count >= this.maxCount) {
                    clearTimeout(timer);
                    resolve();
                }
                this.logger.log('SuperTasks task1:', count);
            }.bind(this), 1000);
        }.bind(this));
    }
    task2() {
        var count = 0;

        return new Promise(function(resolve, reject) {
            var timer = setInterval(function () {
                count++;
                if (count >= this.maxCount) {
                    clearTimeout(timer);
                    resolve();
                }
                this.logger.log('SuperTasks task2:', count);
            }.bind(this), 1100);
        }.bind(this) );
    }

    seqTask() {
        //this.logger.log('SuperTasks seqTask');
        return this.$sequance('SuperTasks.task1', this.task2, 'SuperTasks.lineTask');
    }

    palTask() {
        this.logger.log('SuperTasks palTask');
        return this.$parallel('SuperTasks.task1', this.task2);
    }

    lineTask() {
        this.logger.log('------------------------------');
    }

    comboTask() {
        //this.logger.log('SuperTasks comboTask');
        return this.$sequance('SuperTasks.task1', 'SuperTasks.lineTask', this.palTask, 'SuperTasks.lineTask', 'SuperTasks.task2');
    }

}

Beelzebub.add( SuperTasks );

console.log('-------------------------');
Beelzebub.run('MyBaseTasks.task1');
//Beelzebub.run('MyBaseTasks.task2');
Beelzebub.run('MyTasks.task1');
//Beelzebub.run('MyTasks.task3');
//Beelzebub.run('MyTasks.task2');

//Beelzebub.run('SuperTasks.task1');
//Beelzebub.run('SuperTasks.seqTask');
//Beelzebub.run('SuperTasks.palTask');
Beelzebub.run('SuperTasks.comboTask');

//Beelzebub.run('SuperTasks.MyTasks.task1'); // dulpicate?
//Beelzebub.run('SuperTasks.MyTasks.task2');
//Beelzebub.run('SuperTasks.MyTasks.task3');
