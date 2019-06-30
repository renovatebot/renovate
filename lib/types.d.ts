declare namespace Renovate {
  interface IDict<T> {
    [key: string]: T;
  }
}

declare interface Error {
  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    gitAuthor?: { name: string; email: string };

    renovateError?: boolean;
  }
}
