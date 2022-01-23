import { fold } from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import * as t from 'io-ts';
import type { CdnjsResponse } from './types';

const Response = t.intersection([
  t.type({
    assets: t.array(
      t.type({
        version: t.string,
        files: t.array(t.string),
        sri: t.record(t.string, t.string),
      })
    ),
  }),
  t.partial({
    homepage: t.string,
    repository: t.partial({ url: t.string }),
  }),
]);

export type IResponse = CdnjsResponse;

export function validResponse(input: unknown): IResponse | null {
  return pipe(
    Response.decode(input),
    fold(() => null, identity)
  );
}
