import is from '@sindresorhus/is';
// eslint-disable-next-line import/no-cycle
import prepareError from './utils';

Error.stackTraceLimit = 20;

export default function errSerializer(err: Error): any {
  const response: Record<string, unknown> = prepareError(err);

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
