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
        console.error('default function is a decorator it should not be called directly');
      }

      if (!_.isObject(target.$helpDocs)) {
        target.$helpDocs = {};
      }
      target.$helpDocs[prop] = desc;
    };
  }
}

module.exports = Decorators;
