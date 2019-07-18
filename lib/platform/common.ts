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
  isFork: boolean;
  privateRepo?: boolean;
  // do we need this?
  repoFullName: string;
}

export interface RepoConfig {
  localDir: string;
  optimizeForDisabled?: boolean;
  repository: string;
}
