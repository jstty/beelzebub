const fs = require('fs');

const Beelzebub = require('../');
Beelzebub({
    verbose: true
});

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");
    }

    task1(){
        var data = '';

        return fs.createReadStream('./basic_helloworld.js')
            .setEncoding('utf8')
            .on('data', (chunk) => {
                data += chunk;
            })
            .on('end', () => {
                this.logger.log('MyTasks task1 data size:', data.length);
                //this.logger.log('MyTasks task1 data:', data);
            });
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
Beelzebub.sequance('MyTasks.task1', 'MyTasks.task2');
