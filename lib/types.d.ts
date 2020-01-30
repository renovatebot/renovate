declare namespace Renovate {
  interface Cache {
    get<T = any>(namespace: string, key: string): Promise<T>;
    rm(namespace: string, key: string): Promise<void>;
    rmAll(): Promise<void>;

    set<T = any>(
      namespace: string,
      key: string,
      value: T,
      ttlMinutes?: number
    ): Promise<void>;
  }
}

declare interface Error {
  configFile?: string;

  statusCode?: number;

  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    appMode?: boolean;
    gitAuthor?: { name: string; email: string };

    renovateCache: Renovate.Cache;

    repoCache: Record<string, any>;

    trustLevel?: string;

    updateRubyGemsVersions?: Promise<void>;
  }
}

declare let renovateCache: Renovate.Cache;

// can't use `resolveJsonModule` because it will copy json files and change dist path
declare module '*.json' {
  const value: { version: string } & Record<string, any>;
  export = value;
}
