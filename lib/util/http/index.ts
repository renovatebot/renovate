// v8 ignore file
// TODO: add test #40625 (zero coverage?)
import { EmptyResultError } from './errors.ts';
import { RequestError } from './got.ts';
import { HttpBase } from './http.ts';

export { RequestError as HttpError, EmptyResultError };

export type * from './types.ts';

export class Http extends HttpBase {}
