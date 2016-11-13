'use strict';

var _          = require('lodash');
var path       = require('path');
var Stumpy     = require('stumpy');
var shell      = require('shelljs');

var Beelzebub = require('../../index.js');
var common    = require('../util/common.js');
var expect    = common.expect;

var rootPath = __dirname;
var examplePath = path.join(rootPath, '..' + path.sep + '..' + path.sep + 'examples' + path.sep);
// console.log("root dir:", rootPath, "\n");
var timeoutSec = 200;

var list = require('./tests-list.js');

// install all example dependancy
shell.exec('cd ' + examplePath + '; npm install');

// increase listener limit
process.setMaxListeners(0);

// iterate over all test groups
_.forEach(list, function (testList, item) {
  // create group for each test
  describe(item, function () {
    this.timeout(timeoutSec * 1000);

    // iterate over all tests in group
    _.forEach(testList, function (config, name) {
      describe(name, function () {
        // create sub-group for each test
        var app = {};
        var dt = path.join(rootPath, '.' + path.sep + item + path.sep + name + '.js');
        // console.log("example test dir:", dt, "\n");
        var tests = require(dt);

        // initialize server for test
        before(function (done) {
          var d = path.join(examplePath, item);
          // console.log("example dir:", d, "\n");
          process.chdir(d);
          // exec('npm install', { silent: true });
          // console.log("cwd:", process.cwd(), "\n");

          var stumpy = new Stumpy({
                        // display: false,
            buffer: { size: 500 }
          });
          app.config = {
            verbose: true,
            logger:  stumpy
          };

          // try to load app.js file
          try {
            app.file = path.resolve('.' + path.sep + name + '.js');
            // console.log("name:", name, ", appFile:", appFile, "\n");
            // console.log("cwd:", process.cwd(), "\n");
            // console.log(name, "config:", app.config);
            if (config.type !== 'cli') {
              let wrapper = require(app.file);
              wrapper(app.config).then((bz) => {
                // console.log(name, ', buffer:', app.config.logger.getBuffer());
                app.tasks = bz;
                done();
              });
            }
          } catch (err) {
            expect(err).not.to.be.null;
            console.error(err);
          }

          // console.log("app:", !!app, "\n");
          expect(app).not.to.be.null;

          if (config.type === 'cli') {
            done();
          }
        });

        after(function () {
          Beelzebub.delete();
        });

        // iterated over all sub-tests for a single group test
        tests.forEach(function (test, idx) {
          it('Test ' + (idx + 1), function (done) {
            if (config.type === 'cli') {
              var argv = [];
              // file needs to added first
              argv.push('-f ' + app.file);

              _.forEach(config.args, (item) => {
                argv.push(item);
              });

              Beelzebub
                .cli(app.config, argv)
                .then((bz) => {
                  app.tasks = bz;
                  test(app);
                  done();
                })
                .catch((err) => {
                  console.error('CLI Run Error:', err);
                });
            }
            else {
              // console.log(name, ", buffer:", app.config.logger.getBuffer());
              expect(app).to.not.be.null;

              test(app);
              done();
            }
          });
        });
      });
    });
  });
});
