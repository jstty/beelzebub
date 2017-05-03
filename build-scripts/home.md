<center id="top">
<div class="logo-wrapper">
    <div class="bz"><img width="212px" src="assets/bz-logo.svg" /></div>
    <div>
        <div class="name">beelzebub</div>
        <div class="tagline">One Hell of a Task Master!</div>
    </div>
</div>
<div class="links">
    <div class="item"><a target="_blank" href="https://www.npmjs.com/package/beelzebub"><img width="64px" src="assets/npm-logo.svg" /></a></div>
    <div class="item"><a target="_blank" href="https://github.com/jstty/beelzebub"><img width="64px" src="assets/github-logo.svg" /></a></div>
</div>
</center>

A modern task runner pipeline framwork.
Allows your Tasks to be Module, Extendable, Flexiable, Managable, and Fire Resistent!

## Features
1. Tasks are based on Promises, support: 
    * Generator  ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/async.js))
        * Using [co wrapping](https://github.com/tj/co)
    * Async/Await ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/async.js))
    * Streams ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/stream.js))
        * Compatiable with your existing `gulp` tasks
2. ES6 Class base class
    * Extending from other Tasks ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/extend.js))
3. Sub Tasks
    * Static - simply by adding another task class to a tasks sub class. ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/subtasksSimple.js))
    * Dynamic - create sub tasks based on configuration ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/subtasksAdvanced.js))
4. Run other tasks in an task
    * Parallel ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/parallel.js))
    * Sequance ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/sequence.js))
5. Before and After ([Simple Example](https://github.com/jstty/beelzebub/blob/master/examples/api/beforeAfter.js), [Adv Example](https://github.com/jstty/beelzebub/blob/master/examples/api/beforeAfterAdvanced.js))
    * each task
    * all tasks
6. Decorators
    * Setting Default Task ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/decoratorHelp.js))
    * Help Docs ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/decoratorHelp.js))
    * Vars Definitions (for help and set defaults) ([Example](https://github.com/jstty/beelzebub/blob/master/examples/api/decoratorVars.js))
7. Auto Help Docs ([ALI Example](https://github.com/jstty/beelzebub/blob/master/examples/api/helpDocs.js), [CLI Example](https://github.com/jstty/beelzebub/blob/master/examples/cli/helpDocs.js))
8. Passing Options (Vars) to a task or globally ([ALI Example](https://github.com/jstty/beelzebub/blob/master/examples/api/passingVars.js), [CLI Example](https://github.com/jstty/beelzebub/blob/master/examples/cli/defineVars.js))
9. CLI ([Examples](https://github.com/jstty/beelzebub/blob/master/examples/cli)) and full Javascript API ([Examples](https://github.com/jstty/beelzebub/blob/master/examples/api))
10. **Totally bad *ss logo!**

-------
# Install

## API
```shell
$ npm install beelzebub
```

## CLI
```shell
$ npm install beelzebub -g
```
