// these declarations will be removed once the types.ts file for Pep440 is ready
interface parsed {
  public: string;
  base_version: string;
  is_prerelease: boolean;
  is_devrelease: boolean;
  is_postrelease: boolean;
  epoch: number;
  release: number[];
  pre: (string | number)[];
  post: (string | number)[];
  dev: (string | number)[];
  local: string | null;
}

declare module '@renovate/pep440' {
  import { SemVer } from 'semver';

  export function compare(version: string, other: string): number;
  export function satisfies(version: string, specifier: string): boolean;
  export function valid(version: string): string | null;
  export function validRange(specifier: string): boolean;
  export function explain(version: string): parsed;
  export function gt(version: string, other: string): boolean;
  export function major(input: string | SemVer): number;
  export function minor(input: string | SemVer): number;
  export function patch(input: string | SemVer): number;
  export function eq(version: string, other: string): boolean;
  export function gte(version: string, other: string): boolean;
  export function lte(version: string, other: string): boolean;
  export function lt(version: string, other: string): boolean;
}
declare module '@renovate/pep440/lib/specifier.js' {
  interface Range {
    operator: string;
    prefix: string;
    version: string;
  }
  const RANGE_PATTERN: string;
  export function parse(ranges: string): Range[];
  export function filter(versions: string[], range: string): string[];
}
declare module '@renovate/pep440/lib/version.js' {
  export function parse(version: string, regex?: RegExp): parsed | null;
}
