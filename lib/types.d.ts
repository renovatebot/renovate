declare namespace Renovate {
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
