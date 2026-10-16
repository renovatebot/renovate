import { z } from 'zod/v4';
import { regEx } from '../../../util/regex.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';
import type { CpanRelease } from './types.ts';

/**
 * https://fastapi.metacpan.org/v1/file/_mapping
 */
const MetaCpanApiFile = z
  .object({
    module: LooseArray(
      z.object({
        name: z.string(),
        version: z.string(),
      }),
    ),
    distribution: z.string(),
    date: MaybeTimestamp,
    deprecated: z.boolean(),
    maturity: z.string(),
    status: z.union([
      z.literal('backpan'),
      z.literal('cpan'),
      z.literal('latest'),
    ]),
  })
  .transform(
    ({
      module,
      distribution,
      date,
      deprecated,
      maturity,
      status,
    }): CpanRelease | undefined => {
      if (!module[0]?.version) {
        return undefined;
      }
      return {
        // Modules with dotted-decimal versions are published with a leading
        // 'v' (e.g. `v1.1.1`); strip it so versions match the cpanfile, where
        // the manager already reads them without the prefix.
        version: module[0].version.replace(regEx(/^v/), ''),
        distribution,
        isDeprecated: deprecated,
        isStable: maturity === 'released',
        releaseTimestamp: date,
        isLatest: status === 'latest',
      };
    },
  )
  .catch(undefined);
/**
 * https://github.com/metacpan/metacpan-api/blob/master/docs/API-docs.md#available-fields
 */
export const MetaCpanApiFileSearchResponse = z
  .object({
    hits: z.object({
      hits: LooseArray(
        z.object({
          _source: MetaCpanApiFile,
        }),
      ),
    }),
  })
  .transform((data): CpanRelease[] => {
    // Extract all hits and filter out ones where _source transformed to undefined
    return data.hits.hits
      .map((hit) => hit._source)
      .filter((source) => source !== undefined);
  });
