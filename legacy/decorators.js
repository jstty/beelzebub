'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = require('lodash');

/**
 * ========================================================
 * Decorators
 * ========================================================
 */

var Decorators = function () {
  function Decorators() {
    (0, _classCallCheck3.default)(this, Decorators);
  }

  (0, _createClass3.default)(Decorators, null, [{
    key: 'defaultTask',
    value: function defaultTask(target, prop, descriptor) {
      if (!target || !prop || !descriptor) {
        console.error('default function is a decorator it should not be called directly');
      }

      target.$defaultTask = prop;
    }
  }, {
    key: 'help',
    value: function help(desc) {
      return function (target, prop, descriptor) {
        if (!target || !prop || !descriptor) {
          console.error('default function is a decorator it should not be called directly');
        }

        if (!_.isObject(target.$helpDocs)) {
          target.$helpDocs = {};
        }
        target.$helpDocs[prop] = desc;
      };
    }
  }]);
  return Decorators;
}();

module.exports = Decorators;