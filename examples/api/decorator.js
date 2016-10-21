'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

/**
 * -- Note --
 * Node does not support decorators so you will need to run this with bable-cli
 * $ ../../node_modules/.bin/babel-node decorator.js
 *
 * To use in your own projects you will need to add babel with the
 * 'babel-plugin-transform-decorators-legacy' plugin
 */
  require('babel-register');
  
  return require('./decoratorVars.js'); 
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
