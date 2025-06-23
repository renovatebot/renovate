import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { CpanRelease } from './types';

/**
 * https://fastapi.metacpan.org/v1/file/_mapping
 */
const MetaCpanApiFileSchema = z
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
      return {
        version: module[0].version,
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
          _source: MetaCpanApiFileSchema,
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
