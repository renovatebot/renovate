import is from '@sindresorhus/is';
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
        /https:\/\/[^@]*?@/g, // TODO #12874
        'https://**redacted**@',
      );
    }
  }
  return response;
}
