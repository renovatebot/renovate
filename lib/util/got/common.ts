import got from 'got';
import { Url } from 'url';

export interface Options {
  hostType?: string;
  search?: string;
  token?: string;
  useCache?: boolean;
}

export type GotJSONOptions = Options & got.GotJSONOptions;
export type GotStreamOptions = Options & got.GotOptions<string | null>;

export type GotUrl = string | Url;

export interface GotFn {
  <T extends object = any>(
    url: GotUrl,
    options?: GotJSONOptions
  ): got.GotPromise<T>;

  <T extends Buffer | string = any>(
    url: GotUrl,
    options?: Options & got.GotBodyOptions<string | null>
  ): got.GotPromise<T>;
}

export interface Got
  extends GotFn,
    Record<'get' | 'post' | 'put' | 'patch' | 'head' | 'delete', GotFn> {
  stream(url: GotUrl, options?: GotStreamOptions): NodeJS.ReadableStream;
}
