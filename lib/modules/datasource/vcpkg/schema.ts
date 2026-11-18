import { isString } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { Timestamp } from '../../../util/timestamp.ts';

const VcpkgPortVersionEntry = z
  .object({
    'git-tree': z.string(),
    'port-version': z.number().int().nonnegative().optional(),
    version: z.string().optional(),
    'version-semver': z.string().optional(),
    'version-date': z.string().optional(),
    'version-string': z.string().optional(),
  })
  .refine(
    (entry) =>
      isString(
        entry.version ??
          entry['version-semver'] ??
          entry['version-date'] ??
          entry['version-string'],
      ),
    {
      error:
        'one of version, version-semver, version-date, version-string is required',
    },
  );

export const VcpkgPortVersions = z.object({
  versions: z.array(VcpkgPortVersionEntry).min(1),
});

export type VcpkgPortVersions = z.infer<typeof VcpkgPortVersions>;

/**
 * The GitHub GraphQL response with the text and the blame of a versions file,
 * as the text and the line ranges with the commit time of each.
 */
export const VcpkgBlameResponse = z
  .object({
    data: z.object({
      repository: z.object({
        object: z.object({
          file: z.object({ object: z.object({ text: z.string() }) }),
          blame: z.object({
            ranges: z.array(
              z.object({
                startingLine: z.number().int(),
                endingLine: z.number().int(),
                commit: z.object({ committedDate: Timestamp }),
              }),
            ),
          }),
        }),
      }),
    }),
  })
  .transform(({ data: { repository } }) => ({
    text: repository.object.file.object.text,
    ranges: repository.object.blame.ranges.map(
      ({ startingLine, endingLine, commit }) => ({
        startingLine,
        endingLine,
        committedDate: commit.committedDate,
      }),
    ),
  }));
