const is = require('@sindresorhus/is');

module.exports = errSerializer;

function errSerializer(err) {
  const response = {
    ...err,
  };
  if (err.body) {
    response.body = err.body;
  } else if (err.response && err.response.body) {
    response.body = err.response.body;
  }
  if (err.message) {
    response.message = err.message;
  }
  if (err.stack) {
    response.stack = err.stack;
  }
  if (err.gotOptions && err.gotOptions.headers) {
    const redactedHeaders = [
      'authorization',
      'private-header',
      'Private-header',
    ];
    redactedHeaders.forEach(header => {
      if (response.gotOptions.headers[header]) {
        response.gotOptions.headers[header] = '** redacted **';
      }
    });
  }
  const redactedFields = ['message', 'stack', 'stdout', 'stderr'];
  for (const field of redactedFields) {
    if (is.string(response[field])) {
      response[field] = response[field].replace(
        /https:\/\/[^@]*@/g,
        'https://**redacted**@'
      );
    }
  }
  return response;
}
