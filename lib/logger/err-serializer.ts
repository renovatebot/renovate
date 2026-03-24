import { isString } from '@sindresorhus/is';
import { regEx } from '../util/regex.ts';
import prepareError from './utils.ts';

Error.stackTraceLimit = 20;

export default function errSerializer(err: Error): any {
  const response: Record<string, unknown> = prepareError(err);

  // already done by `sanitizeValue` ?
  const redactedFields = ['message', 'stack', 'stdout', 'stderr'];
  for (const field of redactedFields) {
    const val = response[field];
    if (isString(val)) {
      response[field] = val.replace(
        regEx(/https:\/\/[^@]*?@/g),
        'https://**redacted**@',
      );
    }
  }
  return response;
}
