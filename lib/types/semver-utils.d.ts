declare module 'semver-utils' {
  export function parse(version: string): any;

  export function stringify(veriosn: any): string;

  export function parseRange(range: string): any[];
}
