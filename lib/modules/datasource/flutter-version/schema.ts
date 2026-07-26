import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const FlutterRelease = z.object({
  hash: z.string().optional(),
  channel: z.string(),
  version: z.string(),
  dart_sdk_version: z.string().optional(),
  dart_sdk_arch: z.string().optional(),
  release_date: z.string().optional(),
  archive: z.string().optional(),
  sha256: z.string().optional(),
});

export const FlutterResponse = z.object({
  base_url: z.string().optional(),
  current_release: z.record(z.string(), z.string()).optional(),
  releases: LooseArray(FlutterRelease),
});

export type FlutterResponse = z.infer<typeof FlutterResponse>;
