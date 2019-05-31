import got from 'got';

export interface IGotApiOptions {
  useCache?: boolean;
  hostType?: string;
  body?: any;
}

export interface IGotApi<TOptions extends object = any> {
  get<T extends object = any>(
    url: string,
    options?: IGotApiOptions & TOptions
  ): Promise<got.Response<T>>;
  post<T extends object = any>(
    url: string,
    options?: IGotApiOptions & TOptions
  ): Promise<got.Response<T>>;
  put<T extends object = any>(
    url: string,
    options?: IGotApiOptions & TOptions
  ): Promise<got.Response<T>>;
  patch<T extends object = any>(
    url: string,
    options?: IGotApiOptions & TOptions
  ): Promise<got.Response<T>>;
  head<T extends object = any>(
    url: string,
    options?: IGotApiOptions & TOptions
  ): Promise<got.Response<T>>;
  delete<T extends object = any>(
    url: string,
    options?: IGotApiOptions & TOptions
  ): Promise<got.Response<T>>;

  reset(): void;

  setBaseUrl(endpoint: string): void;
}

export interface PlatformConfig {
  isFork: boolean;
}
