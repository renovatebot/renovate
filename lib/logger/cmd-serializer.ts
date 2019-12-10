// istanbul ignore next
export default function(cmd: string): string {
  return cmd.replace(/https:\/\/[^@]*@/g, 'https://**redacted**@');
}
