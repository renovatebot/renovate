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
  export function getInstalledPath(arg: string): Promise<string>;
}
