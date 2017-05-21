'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BzTasks = require('./bzTasksClass.js');
var util = require('./util.js');

/**
 * Beelzebub Interface Task Class, should be extended
 * @class
 */

var InterfaceTasks = function (_BzTasks) {
  (0, _inherits3.default)(InterfaceTasks, _BzTasks);

  function InterfaceTasks(config) {
    (0, _classCallCheck3.default)(this, InterfaceTasks);
    return (0, _possibleConstructorReturn3.default)(this, (InterfaceTasks.__proto__ || (0, _getPrototypeOf2.default)(InterfaceTasks)).call(this, config));
  }

  /**
   * This needs to be Extented
   * @interface
   * @example {@embed ../examples/api/interfaceTask.js}
   */


  (0, _createClass3.default)(InterfaceTasks, [{
    key: '$replaceWith',
    value: function $replaceWith() {
      this.logger.error('$replaceWith should be replaced');
      return null;
    }

    /**
     * This extends from BzTasks
     * @private
     */

  }, {
    key: '$register',
    value: function $register() {
      var _this2 = this;

      var tasksClass = this.$replaceWith(this.$config());
      if (tasksClass) {
        if (util.isPromise(tasksClass)) {
          tasksClass.then(function (tasksClass) {
            _this2.beelzebub.add(tasksClass, { name: _this2.name });
          }).catch(function (err) {
            _this2.logger.error('$replaceWith Error:', err);
          });
        } else {
          this.beelzebub.add(tasksClass, { name: this.name });
        }
      }

      return _promise2.default.resolve();
    }
  }]);
  return InterfaceTasks;
}(BzTasks);

module.exports = InterfaceTasks;