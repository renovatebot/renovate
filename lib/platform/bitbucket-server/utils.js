const url = require('url');
const api = require('./bb-got-wrapper');
const bbUtils = require('../bitbucket/utils');

const accumulateValues = async (reqUrl, method = 'get', options, limit) => {
  let accumulator = [];
  let nextUrl = addMaxLengthV2(reqUrl, limit);
  const lowerCaseMethod = method.toLocaleLowerCase();

  while (typeof nextUrl !== 'undefined') {
    const { body } = await api[lowerCaseMethod](nextUrl, options);
    accumulator = [...accumulator, ...body.values];
    nextUrl = body.isLastPage
      ? undefined
      : url.format({
          ...url.parse(nextUrl),
          query: {
            ...url.parse(nextUrl, true).query,
            start: body.nextPageStart,
          },
        });
  }

  return accumulator;
};

module.exports = {
  ...bbUtils,
  accumulateValues,
};
