'use strict';

const exec    = require('child_process').exec;
const path    = require('path');
const shelljs = require('shelljs');
const _       = require('lodash');
const glob    = require('glob');

const utils   = require('./build-utils.js');
const pkg     = require('../package.json');

const basePath = __dirname;
const jsDocBin = path.join(basePath, '..', 'node_modules', '.bin', 'jsdoc');
const jsDocConfig = path.join(basePath, 'jsdoc-conf.json');
const homeFile = path.join(basePath, 'home.md');
const libDir = path.join(basePath, '..', 'lib');
const destDir = path.join(basePath, '..', 'docs', 'site');

let jsdocExec = `${jsDocBin} -c ${jsDocConfig} -R ${homeFile} -r ${libDir} -d ${destDir}`;

console.log('Building Site...');
exec(jsdocExec, (err, stdout, stderr) => {
    if (err) {
        console.error(`Exec Error: ${err}`);
        return;
    }
    console.log('-------------------------------------');
    console.log(stdout);
    console.log('-------------------------------------');

    // copy home.css to docs/site/styles
    console.log('Copying files...');
    shelljs.cp('-R', path.join(basePath, '..', 'assets'), destDir);
    shelljs.cp(path.join(basePath, 'home.css'), path.join(destDir, 'styles'));

    // add style to index file
    let indexFile = path.join(destDir, 'index.html');
    console.log('Injecting Style...');
    utils.injectBefore(indexFile, '</head>', '<link type="text/css" rel="stylesheet" href="styles/home.css">');
    utils.searchReplace(indexFile, 'Home - Documentation', `${pkg.name} - ${pkg.description}`);

    // search all '*.html' files in docs/site
    // replace all @embed with examples
    console.log('Injecting Examples...');
    console.log('-------------------------------------');
    glob(path.join(destDir, '**', '*.html'), {}, (err, files) => {
        if (err) {
            console.error(`Glob Search Error: ${err}`);
            return;
        }

        _.forEach(files, (file) => {
            console.log('Into:', file);
            utils.injectExampleLinksIntoFile(libDir, file);
            utils.searchReplaceBlock(file, '<footer>', '</footer>', '');
        });

        console.log('-------------------------------------');
        console.log('Done!');
    });
});
