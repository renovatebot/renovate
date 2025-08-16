import { z } from 'zod';

const UnityReleaseNote = z.object({
  url: z.string(),
});

const UnityRelease = z.object({
  version: z.string(),
  releaseDate: z.string(),
  releaseNotes: UnityReleaseNote,
  shortRevision: z.string(),
});

export const UnityReleasesJSON = z.object({
  total: z.number(),
  results: UnityRelease.array(),
});
export type UnityReleasesJSON = z.infer<typeof UnityReleasesJSON>;
