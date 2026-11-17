import type { Result } from '../../../util/result.ts';

export type VersionsResult = Result<
  string[],
  'unsupported-api' | 'package-not-found'
>;
