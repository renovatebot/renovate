/* c8 ignore next */
export default function cmdSerializer(
  cmd: string | string[]
): string | string[] /* c8 ignore start */ {
  if (typeof cmd === 'string') {
    return cmd.replace(/https:\/\/[^@]*@/g, 'https://**redacted**@');
  }
  return cmd;
} /* c8 ignore stop */
