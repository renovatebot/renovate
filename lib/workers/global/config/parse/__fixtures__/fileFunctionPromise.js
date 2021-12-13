// This is functionally equivalent to fileAsyncFunction.js but syntactically different

// @ts-ignore
module.exports = function () {
  return new Promise(resolve => {
    resolve({
          token: 'abcdefg',
    })
  });
};
