import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import type { ReleaseResult } from '../types';
import { conanDatasourceRegex } from './common';

export const ConanCenterReleases = z
  .object({
    versions: z.record(z.string(), z.unknown()),
  })
  .transform(
    ({ versions }): ReleaseResult => ({
      releases: Object.keys(versions).map((version) => ({ version })),
    }),
  )
  .nullable()
  .catch(null);

export const ConanJSON = z
  .object({
    results: z
      .string()
      .array()
      .transform((array) =>
        array.map((val) => val.match(conanDatasourceRegex)?.groups),
      )
      .pipe(
        LooseArray(
          z.object({
            name: z.string(),
            version: z.string(),
            userChannel: z.string(),
          }),
        ),
      ),
  })
  .transform(({ results }) => results)
  .nullable()
  .catch(null);

export const ConanRevisionJSON = z.object({
  revision: z.string(),
  time: z.string(),
});

export const ConanLatestRevision = z
  .object({ revisions: z.unknown().array() })
  .transform(({ revisions }) => revisions[0])
  .pipe(ConanRevisionJSON)
  .transform(({ revision }) => revision)
  .nullable()
  .catch(null);

export const ConanProperties = z
  .object({
    properties: z.object({
      'conan.package.url': z.union([
        z.string().transform((url) => [url]),
        z.string().array(),
      ]),
    }),
  })
  .transform(({ properties }) => {
    const sourceUrl = properties['conan.package.url'][0];
    return { sourceUrl };
  });
