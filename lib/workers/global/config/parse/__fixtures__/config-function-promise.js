// This is functionally equivalent to config-async-function.js but syntactically different

module.exports = function () {
  return new Promise(resolve => {
    resolve({
          token: 'abcdefg',
    })
  });
};
