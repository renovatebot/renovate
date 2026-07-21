import { isString } from '@sindresorhus/is';
import { regEx } from '../util/regex.ts';

export default function cmdSerializer(
  cmd: string | string[],
): string | string[] {
  if (isString(cmd)) {
    return cmd.replace(regEx(/https:\/\/[^@]*@/g), 'https://**redacted**@');
  }
  return cmd;
}
