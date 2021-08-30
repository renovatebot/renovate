declare module 'www-authenticate' {
  interface wwwAuthenticate {
    (username: string, password: string): unknown;
  }

  namespace wwwAuthenticate {
    namespace parsers {
      class WWW_Authenticate {
        readonly scheme: string;
        readonly parms: Record<string, string>;

        constructor(value: string);
      }
    }
  }

  export = wwwAuthenticate;
}
