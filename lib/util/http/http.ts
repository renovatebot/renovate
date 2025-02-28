import type { Options } from 'got';
import type { SetRequired } from 'type-fest';
import type { ZodType } from 'zod';
import type { GotOptions, HttpMethod, HttpOptions } from './types';

export interface InternalJsonUnsafeOptions<
  Opts extends HttpOptions = HttpOptions,
> {
  url: string | URL;
  httpOptions?: Opts;
}

export interface InternalJsonOptions<
  Opts extends HttpOptions,
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> extends InternalJsonUnsafeOptions<Opts> {
  schema?: Schema;
}

export type InternalGotOptions = SetRequired<GotOptions, 'method' | 'context'>;

export interface InternalHttpOptions extends HttpOptions {
  json?: HttpOptions['body'];

  method?: HttpMethod;

  parseJson?: Options['parseJson'];
}
