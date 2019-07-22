declare module 'github-url-from-git' {
  interface Options {
    extraBaseUrls?: string[];
  }
  function parse(uri: string, options?: Options): string;
  export = parse;
}
