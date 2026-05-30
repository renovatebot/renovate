import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const FlutterReleaseSchema = z.object({
  hash: z.string().optional().nullable(),
  channel: z.string(),
  version: z.string(),
  dart_sdk_version: z.string().optional().nullable(),
  dart_sdk_arch: z.string().optional().nullable(),
  release_date: z.string().optional().nullable(),
  archive: z.string().optional().nullable(),
  sha256: z.string().optional().nullable(),
});

export const FlutterResponseSchema = z.object({
  base_url: z.string().optional().nullable(),
  current_release: z.record(z.string(), z.string()).optional().nullable(),
  releases: LooseArray(FlutterReleaseSchema),
});

export type FlutterRelease = z.infer<typeof FlutterReleaseSchema>;
export type FlutterResponse = z.infer<typeof FlutterResponseSchema>;
