import { EmptyResultError } from './errors';
import { RequestError } from './got';
import { HttpBase } from './http';

export { RequestError as HttpError, EmptyResultError };

export type * from './types';

export class Http extends HttpBase {}
