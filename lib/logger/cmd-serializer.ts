// istanbul ignore next
export default function cmdSerializer(
  cmd: string | string[],
): string | string[] {
  if (typeof cmd === 'string') {
    return cmd.replace(/https:\/\/[^@]*@/g, 'https://**redacted**@'); // TODO #12874
  }
  return cmd;
}
