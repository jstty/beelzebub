# beelzebub - Task Class (v1.0.0)

<!-- div class="toc-container" -->

<!-- div -->

## `Methods`
* <a href="#$replaceWith">`$replaceWith`</a>

<!-- /div -->

<!-- /div -->

<!-- div class="doc-container" -->

<!-- div -->

## `Methods`

<!-- div -->

<h3 id="$replaceWith"><a href="#$replaceWith">#</a>&nbsp;<code>$replaceWith()</code></h3>
[&#x24C8;](../lib/bzTasks.js#L19 "View in source") [&#x24C9;][1]

This needs to be Extented

#### Example
```js
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyCustomTasks1 extends Beelzebub.Tasks {
    task1 () {
      this.logger.log('MyCustomTasks1 task1');
    }
  }

  class MyCustomTasks2 extends Beelzebub.Tasks {
    task1 () {
      this.logger.log('MyCustomTasks2 task1');
    }
  }

  class MyTasks extends Beelzebub.InterfaceTasks {
    $replaceWith (config) {
      let tasksClass = null;

      if (config.interfaceType === 'MyCustomTasks1') {
        tasksClass = MyCustomTasks1;
      }
      else if (config.interfaceType === 'MyCustomTasks2') {
        tasksClass = Promise.resolve(MyCustomTasks2);
      }

      return tasksClass;
    }
  }

  bz.add(MyTasks, { interfaceType: 'MyCustomTasks2' });
  let p = bz.run('MyTasks.task1');
/* Output:
MyCustomTasks2 task1
*/

```
---

<!-- /div -->

<!-- /div -->

<!-- /div -->

 [1]: #methods "Jump back to the TOC."
