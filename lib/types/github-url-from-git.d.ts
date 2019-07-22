declare module 'github-url-from-git' {
  function parse(uri: string): string;
  export = parse;
}
