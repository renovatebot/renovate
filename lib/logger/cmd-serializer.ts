import { regEx } from '../util/regex';

export default function cmdSerializer(
  cmd: string | string[],
): string | string[] {
  if (typeof cmd === 'string') {
    return cmd.replace(regEx(/https:\/\/[^@]*@/g), 'https://**redacted**@');
  }
  return cmd;
}
