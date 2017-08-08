require('babel-polyfill');
require('babel-register');

var Beelzebub = require('../index.js');
var cli = new Beelzebub.CLI();
cli.run({
  cwd:  __dirname,
  file: './tasks/root.js'
});
