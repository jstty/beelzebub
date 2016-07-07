# beelzebub
One hell of a task master!
==========================

## Description
Hightly modular promise/yield based build task pipeline, compatiable with gulp, fly, ES5/6/7.
Easy to create modular tasks and import tasks using npm.

# TODO
* [ ] add tests
* [ ] add travis... badges to README
* [ ] add logo/icon
* [ ] propaganda page
* [ ] support decorators (need to wait for offical spec)
* [ ] support async/await (need to wait for offical spec)

# Add ???
* [ ] gulp.util type utils? like logging?
* [ ] add hotfoot
* [ ] pre/post task functions?
* [ ] how to handle configs/options pass to sub groups
* [ ] change task functions to special names?
  * Add string libs
    ```javascript
    bz.use('bz-webpack', 'bz-native-electron', 'bz-native-cordova')
    ```

# DONE!
* [x] add CLI app
  * [x] load 'beelzebub.js' and/or 'beelzebub.json' file like gulpfile.js
  * [x] load file -f
* [x] support root level tasks
* [x] support default task for the given task group
* [x] support generators
* [x] support pipe/steams
  * [x] add function
  * [x] add example

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
