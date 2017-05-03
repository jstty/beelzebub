const fs      = require('fs');
const path    = require('path');
const docdown = require('docdown');

const utils   = require('./build-utils.js');
const pkg     = require('../package.json');
const version = pkg.version;

const basePath = __dirname;
const libDir = path.join(basePath, '..', 'lib');
const destDir = path.join(basePath, '..', 'docs');

// let markdown = docdown({
//   'path':  path.join(basePath, 'index.js'),
//   'title': `beelzebub (v${version})`,
//   'toc':   'categories',
//   'url':   '../lib/index.js'
// });

// fs.writeFile('bz.md', markdown);

console.log('Building Docs...');
let markdown = docdown({
  'path':  path.join(libDir, 'bzTasks.js'),
  'title': `beelzebub - Task Class (v${version})`,
  'toc':   'categories',
  'url':   '../lib/bzTasks.js'
});

console.log('Writng Docs...');
fs.writeFile(path.join(destDir, 'taskClass.md'), utils.injectExampleLinks(libDir, markdown));

console.log('-------------------------------------');
console.log('Done!');
