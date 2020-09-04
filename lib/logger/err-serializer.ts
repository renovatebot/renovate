import is from '@sindresorhus/is';

Error.stackTraceLimit = 20;

interface Err {
  body?: unknown;
  response?: {
    body?: unknown;
    url?: unknown;
  };
  message?: unknown;
  stack?: unknown;
  gotOptions?: {
    auth?: unknown;
    headers?: unknown;
  };
}

export default function errSerializer(err: Err): any {
  const response: Record<string, unknown> = {
    ...err,
  };
  if (err.body) {
    response.body = err.body;
  } else if (err.response?.body) {
    response.body = err.response.body;
  }
  if (err.message) {
    response.message = err.message;
  }
  if (err.stack) {
    response.stack = err.stack;
  }
  if (err.response?.url) {
    response.url = err.response.url;
  }
  if (is.plainObject(response.gotOptions)) {
    if (is.string(response.gotOptions.auth)) {
      response.gotOptions.auth = response.gotOptions.auth.replace(
        /:.*/,
        ':***********'
      );
    }
    if (is.plainObject(response.gotOptions.headers)) {
      const headers = response.gotOptions.headers;
      const redactedHeaders = [
        'authorization',
        'private-header',
        'Private-header',
      ];
      redactedHeaders.forEach((header) => {
        if (headers[header]) {
          headers[header] = '** redacted **';
        }
      });
    }
  }
  const redactedFields = ['message', 'stack', 'stdout', 'stderr'];
  for (const field of redactedFields) {
    const val = response[field];
    if (is.string(val)) {
      response[field] = val.replace(
        /https:\/\/[^@]*?@/g,
        'https://**redacted**@'
      );
    }
  }
  return response;
}
