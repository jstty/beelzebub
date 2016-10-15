
class TmplStrFunc {
  static task (strings, args) {
    let taskName = strings[0].split(':')[0];
    let taskObj = {
      task: taskName,
      vars: args
    };
    return taskObj;
  }
};

module.exports = TmplStrFunc;
