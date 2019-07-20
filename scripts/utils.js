const { spawn, exec } = require('child_process');
const _ = require('lodash');

const defaultLogger = {
  log: (data) => {
    const write = process.stdout.write;
    write.call(process.stdout, data);
  },
  error: (data) => {
    const write = process.stderr.write;
    if(_.isObject(data)) {
      data = JSON.stringify(data, null, 1);
    }
    write.call(process.stderr, data);
  }
};

function promiseSpawn (cmd, logger = defaultLogger)
{
  return new Promise((resolve, reject) => {
    let cmdParts = cmd.split(' ');
    let root = cmdParts.shift();
    let spawnCmd = spawn(root, cmdParts);

    spawnCmd.stdout.on('data', (data) => {
      logger.log(String(data));
    });

    spawnCmd.stderr.on('data', (data) => {
      logger.error(String(data));
    });

    spawnCmd.on('close', (code) => {
      resolve(code);
    });
  });
}

function promiseExec (cmd, logger = defaultLogger)
{
  return new Promise((resolve, reject) => {
    exec(cmd, function (err, stdout, stderr) {
      if (err) {
        logger.error(err);
        reject(err);
        return;
      }

      resolve({
        out: stdout,
        err: stderr
      });
    });
  });
}

module.exports = {
  promiseExec,
  promiseSpawn
};
