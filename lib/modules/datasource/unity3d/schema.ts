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
  results: UnityRelease.array(),
});
