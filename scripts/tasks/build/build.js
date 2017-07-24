'use strict';
/**
 * Running:
 * $ bz build.docs
 * $ bz build.site
 *
 */

const fs      = require('fs');
const path    = require('path');
const shelljs = require('shelljs');
const _       = require('lodash');
const glob    = require('glob');
const docdown = require('docdown');

const Beelzebub  = require('../../../');
const buildUtils = require('./build-utils.js');
const utils      = require('../../utils.js');
const pkg        = require('../../../package.json');
const version    = pkg.version;

const basePath = __dirname;
const projectRootDir = path.join(basePath, '..', '..', '..');

class Build extends Beelzebub.Tasks {
  constructor (config) {
    super(config);
    this.$setName('build');

    this.$setTaskHelpDocs('build.code', 'Builds legacy(ES5) version of the code');
    this.$setTaskHelpDocs('build.docs', 'Builds Markdown Documentation from jsdoc markup in the code');
    this.$setTaskHelpDocs('build.site', 'Builds Site (beelzebub.io) from jsdoc markup in the code');
  }

  default () {
    return this.$sequence(
      'build.code',
      'build.docs',
      'build.site'
    );
  }

  code () {
    const destDir = path.join(projectRootDir, 'legacy');
    const babelPath = path.join(projectRootDir, 'node_modules', '.bin', 'babel');
    let bableExec = `${babelPath} lib --out-dir ${destDir}`;

    this.logger.log('Building Code...');
    return utils.promiseExec(bableExec);
  }

  docs () {
    const destDir = path.join(projectRootDir, 'docs');
    const libDir = path.join(projectRootDir, 'lib');

    this.logger.log('Building Docs...');
    let markdown = docdown({
      'path':  path.join(libDir, 'bzTasksClass.js'),
      'title': `beelzebub - Task Class (v${version})`,
      'toc':   'categories',
      'url':   '../lib/bzTasks.js'
    });

    this.logger.log('Writng Docs...');
    fs.writeFile(path.join(destDir, 'taskClass.md'), buildUtils.injectExampleLinks(libDir, markdown));

    this.logger.log('-------------------------------------');
    markdown = docdown({
      'path':  path.join(libDir, 'bzInterfaceClass.js'),
      'title': `beelzebub - Task Class (v${version})`,
      'toc':   'categories',
      'url':   '../lib/bzTasks.js'
    });

    this.logger.log('Writing Docs...');
    fs.writeFile(path.join(destDir, 'interfaceClass.md'), buildUtils.injectExampleLinks(libDir, markdown));

    this.logger.log('-------------------------------------');
    this.logger.log('Done!');
  }

  site () {
    const destDir = path.join(projectRootDir, 'docs', 'site');
    const libDir = path.join(projectRootDir, 'lib');
    const jsDocBin = path.join(projectRootDir, 'node_modules', '.bin', 'jsdoc');
    const jsDocConfig = path.join(basePath, 'jsdoc-conf.json');
    const homeFile = path.join(basePath, 'home.md');

    let jsdocExec = `${jsDocBin} -c ${jsDocConfig} -R ${homeFile} -r ${libDir} -d ${destDir}`;

    this.logger.log('Building Site...');
    utils.promiseExec(jsdocExec)
    .then(({out, err}) => {
      this.logger.log('-------------------------------------');
      this.logger.log(out);
      this.logger.log('-------------------------------------');

        // copy home.css to docs/site/styles
      this.logger.log('Copying files...');
      shelljs.cp('-R', path.join(projectRootDir, 'assets'), destDir);
      shelljs.cp(path.join(basePath, 'home.css'), path.join(destDir, 'styles'));

        // add style to index file
      let indexFile = path.join(destDir, 'index.html');
      this.logger.log('Injecting Style...');
      buildUtils.injectBefore(indexFile, '</head>', '<link type="text/css" rel="stylesheet" href="styles/home.css">');
      buildUtils.searchReplace(indexFile, 'Home - Documentation', `${pkg.name} - ${pkg.description}`);

        // search all '*.html' files in docs/site
        // replace all @embed with examples
      this.logger.log('Injecting Examples...');
      this.logger.log('-------------------------------------');
      glob(path.join(destDir, '**', '*.html'), {}, (err, files) => {
        if (err) {
          this.logger.error(`Glob Search Error: ${err}`);
          return;
        }

        _.forEach(files, (file) => {
          this.logger.log('Into:', file);
          buildUtils.injectExampleLinksIntoFile(libDir, file);
          buildUtils.searchReplaceBlock(file, '<footer>', '</footer>', '');
        });

        this.logger.log('-------------------------------------');
        this.logger.log('Done!');
      });
    });
  }
}

module.exports = Build;
