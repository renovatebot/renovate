declare module 'conventional-commits-detector' {
  function detector(commits: string[]): string;
  export = detector;
}

declare module 'json-dup-key-validator' {
  export function validate(
    jsonString: string,
    allowDuplicatedKeys?: boolean
  ): string | undefined;

  export function parse<T = unknown>(
    jsonString: string,
    allowDuplicatedKeys?: boolean
  ): T;
}

declare module 'changelog-filename-regex' {
  const re: RegExp;
  export = re;
}

declare module 'linkify-markdown' {
  export function linkify(
    source: string,
    options: Record<string, unknown>
  ): string;
}

declare module 'get-installed-path' {
  interface Options {
    cwd?: string;
    local?: boolean;
    paths?: string[];
  }
  export function getInstalledPath(
    arg: string,
    opts?: Options
  ): Promise<string>;
}

declare module '@snyk/ruby-semver/lib/ruby/gem-version' {
  export function create(version: string): any;
  export function parse(version: string): any;
}

declare module '@snyk/ruby-semver/lib/ruby/gem-requirement' {
  export function parse(version: string): any;
}

declare module '@snyk/ruby-semver' {
  export function diff(a: any, b: any): string;
  export function eq(a: any, b: any): boolean;
  export function gt(a: any, b: any): boolean;
  export function gte(a: any, b: any): boolean;
  export function lte(a: any, b: any): boolean;
  export function major(version: any): number;
  export function maxSatisfying(version: any[], range: string): string;
  export function minSatisfying(version: any[], range: string): string;
  export function minor(version: any): number;
  export function patch(version: any): number;

  export function prerelease(version: any): string[];
  export function satisfies(version: any, range: string): boolean;
  export function valid(version: any): boolean;
}
