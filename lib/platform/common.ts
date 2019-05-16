import got from 'got';

export interface IGotApiOptions {
  useCache?: boolean;
}

export interface IGotApi {
  get<T extends object = any>(
    url: string,
    options?: IGotApiOptions
  ): Promise<got.Response<T>>;
  post<T extends object = any>(
    url: string,
    options?: IGotApiOptions
  ): Promise<got.Response<T>>;
  put<T extends object = any>(
    url: string,
    options?: IGotApiOptions
  ): Promise<got.Response<T>>;
  patch<T extends object = any>(
    url: string,
    options?: IGotApiOptions
  ): Promise<got.Response<T>>;
  head<T extends object = any>(
    url: string,
    options?: IGotApiOptions
  ): Promise<got.Response<T>>;
  delete<T extends object = any>(
    url: string,
    options?: IGotApiOptions
  ): Promise<got.Response<T>>;

  reset(): void;
}
