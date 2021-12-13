// This is functionally equivalent to file-async-function.js but syntactically different

// @ts-ignore
module.exports = function () {
  return new Promise(resolve => {
    resolve({
          token: 'abcdefg',
    })
  });
};
