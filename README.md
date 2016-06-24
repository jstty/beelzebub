# beelzebub
One hell of a task master!
==========================

## Description
Hightly modular promise/yield based build task pipeline, compatiable with gulp, fly, ES5/6/7.
Easy to create modular tasks and import tasks using npm.

# TODO
* [x] support generators
* [/] support pipe/steams
    * [x] add function
    * [ ] add example
* [ ] support root level tasks
* [ ] support default task for the given task group
* [ ] ??? pre/post task functions?
* [ ] ??? how to handle configs/options pass to sub groups
* [ ] support decorators
* [ ] support async/await
* [ ] ??? change task functions to special names or use decorators
* [ ] ??? gulp.util type utils? like logging
* [ ] ??? hotfoot (previously called YANPM) add string libs
* [ ] add CLI app
* [ ] add tests
* [ ] add travis... badges to README
* [ ] add logo/icon
* [ ] propaganda page

# Install
```shell
$ npm install beelzebub
```

# Usage
### Also [See Examples](./examples)
```javascript
var Beelzebub = require('beelzebub');
Beelzebub({
    verbose: true
});

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");
    }

    task1(){
        this.logger.log('MyTasks task1');
    }
}
Beelzebub.add( MyTasks );

// ------------------------------------
Beelzebub.run('MyTasks.task1');
```

--------
## Future example
### in 'bz-tasks.js' file
```javascript
const bz = Beelzebub();

bz.add('bz-frontend-react');
bz.add('bz-frontend-babel');
bz.add( require('mytask.js') );

bz.runCli(); // runs commands from CLI
```

### Running the beelzebub command will auto load the `bz-tasks.js` file
```shell
$ bz MyTasks.task1 --my-custom-flag
```
### OR
```shell
$ node bz-tasks.js MyTasks.task1 --my-custom-flag
```
