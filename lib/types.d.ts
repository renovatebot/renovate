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

  validationError?: string;
  validationMessage?: string;
}

declare namespace NodeJS {
  interface Global {
    appMode?: boolean;
    gitAuthor?: { name: string; email: string };
    renovateError?: boolean;
    renovateVersion: string;
    // TODO: declare interface for all platforms
    platform: typeof import('./platform/github');

    renovateCache: Renovate.Cache;

    repoCache: Record<string, any>;

    trustLevel?: string;
  }
}

declare let platform: typeof import('./platform/github');

declare let renovateCache: Renovate.Cache;
