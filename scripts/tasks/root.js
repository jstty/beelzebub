const path      = require('path');

const Beelzebub = require('../../');
const BuildTask = require('./build/build.js');
const utils     = require('../utils.js');

const basePath = __dirname;
const projectRootDir = path.join(basePath, '..', '..');

class Root extends Beelzebub.Tasks {
  constructor (config) {
    super(config);
    this.$useAsRoot();

    this.$setTaskHelpDocs('help', 'Print all Task help docs');
    this.$setTaskHelpDocs('build', 'Build Code, Docs, Site');
    this.$setTaskHelpDocs('clean', 'Removes all Example dependant files and folders');
    this.$setTaskHelpDocs('lint', 'Run Linter (eslint)');
    this.$setTaskHelpDocs('lint --fix', 'Run Linter with auto-fix enabled');
    this.$setTaskHelpDocs('test', 'Run all tests');
    this.$setTaskHelpDocs('prepublish', 'Builds and then runs all tests');
    this.$setTaskHelpDocs('coveralls', 'Run coveralls');

    this.$defineTaskVars('lint', {
      fix: { type: 'Boolean', default: false }
    });
  }

  $init () {
    this.$addSubTasks(BuildTask);
  }

  help () {
    this.$printHelp();
  }

  prepublish () {
    return this.$sequence(
        'build',
        'test'
    );
  }

  clean () {
    const examplesPath = path.join(projectRootDir, 'examples');
    const cleanExec = `find ${examplesPath} -name 'node_modules' -print0 | xargs -0 rm -rf`;
    return utils.promiseExec(cleanExec);
  }

  lint () {
    // TODO: add 'lint --fix'
    // ${vars.fix ? '--fix' : ''}
    const eslintPath = path.join('.', 'node_modules', '.bin', 'eslint');
    const libPath = path.join('.', 'lib');
    const examplesPath = path.join('.', 'examples');
    const testsPath = path.join('.', 'test');
    const lintExec = `${eslintPath} ${libPath} ${examplesPath} ${testsPath}`;

    return this.$sequence(
      'clean',
      () => {
        return utils.promiseSpawn(lintExec, this.logger);
      }
    )
    .then(() => {

    });
  }

  test () {
    // TODO: add 'test --all'
    // test --all, "npm run lint && cd test && ./test-all-nodes.sh"
    // const istanbulPath = path.join('.', 'node_modules', '.bin', 'istanbul');
    const mochaPath = path.join('.', 'node_modules', '.bin', 'mocha');
    // const istanbulConfigPath = path.join('.', 'test', '.istanbul.yml');
    const testPath = path.join('.', 'test', 'tests.js');

    // const exec = `${istanbulPath} --config=${istanbulConfigPath} cover ${mochaPath} -- --check-leaks -t 5000 -b -R spec ${testPath}`;
    const exec = `${mochaPath} -- --check-leaks -t 5000 -b -R spec ${testPath}`;
    return utils.promiseSpawn(exec);
  }

  coveralls () {
    const lcovPath = path.join('.', 'test', '.coverage', 'lcov.info');
    const coverallsPath = path.join('.', 'node_modules', 'coveralls', 'bin', 'coveralls.js');
    const coverallsExec = `cat ${lcovPath} | ${coverallsPath}`;

    return utils.promiseExec(coverallsExec);
  }
}

module.exports = Root;
