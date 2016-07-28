'use strict';
// !-- FOR TESTS
let wrapper = function(options) {
// --!


// =====================================================
let Beelzebub = require('../../');
let bz = Beelzebub(options || { verbose: true });

const gulp  = require('gulp');
const del   = require('del');
const shell = require('shelljs');

class MyTasks extends Beelzebub.Tasks {
    constructor(config) {
        super(config);
        this.$setName("MyTasks");

        this._src  = './static-files/src';
        this._dest = './static-files/dest';
    }

    CopyFile() {
        this.logger.log('MyTasks - Coping Files');
        return gulp.src(this._src + '/*', {base: this._src})
                   .pipe(gulp.dest(this._dest));
    }

    NumberOfDestFiles() {
        return new Promise((resolve, reject) => {
                shell.exec(
                    `cd ${this._dest}; ls -d -- * | wc -l`,
                    {
                        silent: true,
                        async: true
                    },
                    (code, stdout, stderr) => {
                        if(stderr) {
                            return reject(stderr);
                        }

                        let count = parseInt(stdout);
                        this.logger.log(`MyTasks - Number of Dest Files: ${count}`);
                        resolve();
                    }
                );
        });
    }

    DeleteFiles() {
        this.logger.log('MyTasks - Delete Files');
        return del(this._dest+'/*.txt');
    }

}
bz.add( MyTasks );

bz.run(
    'MyTasks.NumberOfDestFiles',
    'MyTasks.CopyFile',
    'MyTasks.NumberOfDestFiles',
    'MyTasks.DeleteFiles',
    'MyTasks.NumberOfDestFiles'
);
// =====================================================


// !-- FOR TESTS
return bz; };
module.exports = wrapper;
// if not running in test, then run wrapper
if(typeof global.it !== 'function') wrapper();
// --!