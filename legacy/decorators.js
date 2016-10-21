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
          console.error('help function is a decorator it should not be called directly');
        }

        target.$setTaskHelpDocs(prop, desc);
        // console.info('$helpDocs', target.$helpDocs);
      };
    }
  }, {
    key: 'vars',
    value: function vars(varDefs) {
      return function (target, prop, descriptor) {
        if (!target || !prop || !descriptor) {
          console.error('vars function is a decorator it should not be called directly');
        }

        target.$defineTaskVars(prop, varDefs);
        // console.info('$varDefs', target.$varDefs);
      };
    }
  }]);
  return Decorators;
}();

module.exports = Decorators;