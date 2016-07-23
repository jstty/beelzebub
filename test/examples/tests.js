var _        = require('lodash');
var path     = require('path');
var Stumpy   = require('Stumpy');

var bz      = require('../../index.js');
var common  = require('../util/common.js');
var expect  = common.expect;

var rootDir = __dirname;
//console.log("root dir:", rootDir, "\n");
var timeoutSec = 200;

var list = require('./tests-list.js');

// increase listener limit
process.setMaxListeners(0);

// iterate over all test groups
_.forEach(list, function(testList, item){
    // create group for each test
    describe(item, function() {
        this.timeout(timeoutSec * 1000);

        // iterate over all tests in group
        _.forEach(testList, function(appName, name) {

            describe(name, function() {

                // create sub-group for each test
                var app = {};
                var dt = path.join(rootDir, '.' + path.sep + item + path.sep + name +'.js');
                //console.log("example test dir:", dt, "\n");
                var tests = require(dt);

                // initialize server for test
                before(function(done){

                    var d = path.join(rootDir,
                        '..' + path.sep + '..' + path.sep + 'examples' + path.sep +
                        item);


                    // console.log("example dir:", d, "\n");
                    process.chdir(d);
                    // exec('npm install', { silent: true });
                    // console.log("cwd:", process.cwd(), "\n");

                    var stumpy = new Stumpy({
                        display: false,
                        buffer:  { size: 100 }
                    });
                    app.config = {
                        verbose: true,
                        logger: stumpy
                    };

                    // try to load app.js file
                    try {
                        var appFile = path.resolve('.' + path.sep + name + '.js');
                        // console.log("name:", name, ", appFile:", appFile, "\n");
                        // console.log("cwd:", process.cwd(), "\n");
                        // console.log(name, "config:", app.config);
                        app.tasks = require(appFile)(app.config);
                    } catch(err) {
                        expect(err).not.to.be.null;
                        console.error(err);
                    }

                    // console.log("app:", !!app, "\n");
                    expect(app).not.to.be.null;
                    expect(app.tasks).not.to.be.null;

                    var running = app.tasks.getRunning();
                    expect(running).not.to.be.null;
                    running.then(function() {
                        // console.log(name, ", buffer:", app.config.logger.getBuffer());
                        done();
                    });
                });

                after(function(){
                    bz.delete();
                });

                // iterated over all sub-tests for a single group test
                tests.forEach(function(test, idx) {
                    it("Test "+(idx+1), function(done) {
                        // console.log(name, ", buffer:", app.config.logger.getBuffer());
                        test(app);
                        done();
                    });
                });
            });

        });

    });
});
