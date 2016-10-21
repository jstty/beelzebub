'use strict';
const _ = require('lodash');

/**
 * ========================================================
 * Decorators
 * ========================================================
 */
class Decorators {
  static defaultTask (target, prop, descriptor) {
    if (!target || !prop || !descriptor) {
      console.error('default function is a decorator it should not be called directly');
    }

    target.$defaultTask = prop;
  }

  static help (desc) {
    return (target, prop, descriptor) => {
      if (!target || !prop || !descriptor) {
        console.error('help function is a decorator it should not be called directly');
      }

      target.$setTaskHelpDocs(prop, desc);
      // console.info('$helpDocs', target.$helpDocs);
    };
  }

  static vars (varDefs) {
    return (target, prop, descriptor) => {
      if (!target || !prop || !descriptor) {
        console.error('vars function is a decorator it should not be called directly');
      }

      target.$defineTaskVars(prop, varDefs);
      // console.info('$varDefs', target.$varDefs);
    };
  }
}

module.exports = Decorators;
