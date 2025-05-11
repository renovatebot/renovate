import { DateTime } from 'luxon';
import type { ReleaseResult } from '../../../../modules/datasource/types';
import { toMs } from '../../../../util/pretty-time';
import type { LookupUpdateConfig } from './types';

export function calculateAbandonment(
  releaseResult: ReleaseResult,
  config: LookupUpdateConfig,
): ReleaseResult {
  const { abandonmentThreshold } = config;
  if (!abandonmentThreshold) {
    return releaseResult;
  }

  const abandonmentThresholdMs = toMs(abandonmentThreshold);
  if (!abandonmentThresholdMs) {
    return releaseResult;
  }

  const { bumpedAt } = releaseResult;
  if (!bumpedAt) {
    return releaseResult;
  }
  const bumpedAtDate = DateTime.fromISO(bumpedAt);

  const abandonmentDate = bumpedAtDate.plus({
    milliseconds: abandonmentThresholdMs,
  });
  const isAbandoned = abandonmentDate < DateTime.now();
  releaseResult.isAbandoned = isAbandoned;
  return releaseResult;
}
