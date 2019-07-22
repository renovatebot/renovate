declare module 'semver-stable' {
  export function is(version: string): boolean;

  export function max(versions: string[]): string;

  export function maxSatisfying(versions: string[], range: string): string;
}
