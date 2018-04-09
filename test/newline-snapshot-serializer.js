let prev;

module.exports = {
  print(val) {
    return JSON.stringify(val);
  },

  test(val) {
    if (['prBody', 'prTitle'].some(str => str === prev)) {
      return typeof val === 'string' && val.indexOf('\n') > -1;
    }
    prev = val;
    return false;
  },
};
