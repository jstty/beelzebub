var path = require('path');
try {
  var Beelzebub  = require(path.join(process.cwd(), 'node_modules/beelzebub'));
}
catch(e) {
  throw Error('Beelzebub should be installed both locally and globally');
}
var cli = new Beelzebub.CLI();
cli.run();