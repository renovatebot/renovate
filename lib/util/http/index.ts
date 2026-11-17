// v8 ignore file -- barrel re-exports only, no executable logic (#40625)
// TODO: add test #40625 (zero coverage?)
import { RequestError } from './got.ts';
import { HttpBase } from './http.ts';

export type * from './types.ts';
export { RequestError as HttpError };

export class Http extends HttpBase {}
