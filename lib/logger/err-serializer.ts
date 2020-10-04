import is from '@sindresorhus/is';
import { RequestError } from 'got';
import { clone } from '../util/clone';

Error.stackTraceLimit = 20;

export default function errSerializer(err: Error): any {
  const response: Record<string, unknown> = {
    ...err,
  };

  // Can maybe removed?
  if (!response.message && err.message) {
    response.message = err.message;
  }

  // Can maybe removed?
  if (!response.stack && err.stack) {
    response.stack = err.stack;
  }

  // handle got error
  if (err instanceof RequestError) {
    const options: Record<string, unknown> = {
      headers: clone(err.options.headers),
      url: err.options.url?.toString(),
    };
    response.options = options;

    for (const k of ['username', 'password', 'method', 'http2']) {
      options[k] = err.options[k];
    }

    if (err.response) {
      response.response = {
        statusCode: err.response?.statusCode,
        statusMessage: err.response?.statusMessage,
        body: clone(err.response.body),
        headers: clone(err.response.headers),
        httpVersion: err.response.httpVersion,
      };
    }
  }

  // already done by `sanitizeValue` ?
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
