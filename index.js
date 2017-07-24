
// if node 6, use native otherwise switch user legacy
var nodeVersionParts = process.versions.node.split('.');
if (nodeVersionParts[0] > '5') {
  module.exports = require('./lib');
} else {
  module.exports = require('./legacy');
}
