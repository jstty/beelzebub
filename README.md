# Beelzebub - One hell of a task master!
==========================
[![Build Status](https://secure.travis-ci.org/jstty/beelzebub.png?branch=master)](http://travis-ci.org/jstty/beelzebub)
[![bitHound Score](https://www.bithound.io/github/jstty/beelzebub/badges/score.svg?branch=master)](https://www.bithound.io/github/jstty/beelzebub)
[![Coverage Status](https://coveralls.io/repos/jstty/beelzebub/badge.svg?branch=master&service=github)](https://coveralls.io/github/jstty/beelzebub?branch=master)
![License](https://img.shields.io/npm/l/beelzebub.svg)
[![Dependency Status](https://david-dm.org/jstty/beelzebub.png?theme=shields.io&branch=master)](https://david-dm.org/jstty/beelzebub)
[![devDependency Status](https://david-dm.org/jstty/beelzebub/dev-status.png?theme=shields.io&branch=master)](https://david-dm.org/jstty/beelzebub#info=devDependencies) 

[![NPM](https://nodei.co/npm/beelzebub.png)](https://nodei.co/npm/beelzebub/)
==========================

## Description
Hightly modular promise/genorator based build task pipeline, compatiable with gulp, fly, ES 5/6/7.
Easy to create modular tasks and import tasks using npm.

# TODO
* [ ] CLI tests
* [ ] support older node versions (add to tests)
* [ ] gulp.util type utils? like logging, transfuser
* [ ] add hotfoot
  * Add string libs
    ```javascript
    bz.add('bz-webpack', 'bz-native-electron', 'bz-native-cordova')
    ```
* [ ] add logo/icon
* [ ] propaganda page
* [ ] support decorators (need to wait for offical spec)
* [ ] support async/await (need to wait for offical spec)

# Maybe Add/change???
* [ ] pre/post task functions
* [ ] handle configs/options pass to sub groups
* [ ] change task functions to special names

# DONE!
* [x] add travis
* [x] badges to README (this)
* [x] add tests
* [x] moved almost all functions to base class for simplicity
* [x] more examples
* [x] add $init (return promise) auto run for async adding tasks
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
## CLI Example

```shell
$ bz MyTasks.task1
```

### 'beelzebub.js' file
```javascript
module.exports = [
  'bz-frontend-react',
  'bz-frontend-babel',
  require('mytask.js')
];
```
### OR
### 'beelzebub.json' file
```javascript
[
  'bz-frontend-react',
  'bz-frontend-babel',
]
```
