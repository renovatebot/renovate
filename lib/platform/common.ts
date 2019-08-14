import got from 'got';

export interface GotApiOptions {
  useCache?: boolean;
  hostType?: string;
  body?: any;
}

export type GotResponse<T extends object = any> = got.Response<T>;

export interface GotApi<TOptions extends object = any> {
  get<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  post<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  put<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  patch<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  head<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;
  delete<T extends object = any>(
    url: string,
    options?: GotApiOptions & TOptions
  ): Promise<GotResponse<T>>;

  reset(): void;

  setBaseUrl(endpoint: string): void;
}

export interface PlatformConfig {
  endpoint: string;
  renovateUsername?: any;
  gitAuthor?: any;
}

export interface RepoConfig {
  baseBranch: string;
  endpoint?: string;
  renovateUsername?: any;
  gitAuthor?: any;
  isFork: boolean;
}

export interface RepoParams {
  azureWorkItemId?: number; // shouldn't this be configurable within a renovate.json?
  bbUseDefaultReviewers?: boolean; // shouldn't this be configurable within a renovate.json?
  gitPrivateKey?: string;
  localDir: string;
  optimizeForDisabled: boolean;
  repository: string;
  endpoint?: string;
  forkMode?: string;
  forkToken?: string;
  includeForks?: boolean;
  renovateUsername?: string;
}
