export function fileMatch(...args: RegExp[]): string[] {
  return args.map((arg) => {
    let { source: result } = arg;
    result = result.replace(/\((?!:\?)/g, '(?:');
    return result;
  });
}
