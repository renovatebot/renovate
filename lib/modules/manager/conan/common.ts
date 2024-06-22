export function isComment(line: string): boolean {
  return line.trim().startsWith('#');
}
