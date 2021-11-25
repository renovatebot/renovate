// istanbul ignore next
export default function cmdSerializer(
  cmd: string | string[]
): string | string[] {
  if (typeof cmd === 'string') {
    return cmd.replace(/https:\/\/[^@]*@/g, 'https://**redacted**@'); // TODO #12070 using re2 cause problems in running looger.warn
  }
  return cmd;
}
