'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TmplStrFunc = function () {
  function TmplStrFunc() {
    (0, _classCallCheck3.default)(this, TmplStrFunc);
  }

  (0, _createClass3.default)(TmplStrFunc, null, [{
    key: 'task',
    value: function task(strings, args) {
      var taskName = strings[0].split(':')[0];
      var taskObj = {
        task: taskName,
        vars: args
      };
      return taskObj;
    }
  }]);
  return TmplStrFunc;
}();

;

module.exports = TmplStrFunc;