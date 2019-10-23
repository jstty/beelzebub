'use strict';
const Beelzebub = require('beelzebub');

class ImporterScripts extends Beelzebub.Tasks {
  constructor (config) {
    super(config);
    this.$setName('ImporterScripts');
  }

  build() {
    this.run("build.sh");
  }

  test() {
    this.run("echo "Error: no test specified" && exit 1");
  }

  test-npmbin() {
    this.run("mocha --version");
  }

}

module.exports = ImporterScripts;
