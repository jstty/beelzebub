# beelzebub
One hell of a task master!
==========================

## Description
Hightly modular promise/yield based build task pipeline, compatiable with gulp, fly, ES5/6/7.
Easy to create modular tasks and import tasks using npm.

# TODO
[ ] support generators
[ ] support async/await
[ ] support pipe/steams
[ ] support root level tasks
[ ] support default task for the given task group
[ ] ??? change task functions to special names or use decorators
[ ] ??? gulp.util type utils? like logging
[ ] ??? hotfoot (previously called YANPM) add string libs

# usage
```javascript
const bz = Beelzebub();

bz.add('bz-frontend-react');
bz.add('bz-frontend-babel');
bz.add( require('mytask.js') );

```
