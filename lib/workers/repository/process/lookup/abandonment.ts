import { DateTime } from 'luxon';
import { logger } from '../../../../logger';
import type { ReleaseResult } from '../../../../modules/datasource/types';
import { toMs } from '../../../../util/pretty-time';
import { AbandonedPackageStats } from '../../../../util/stats';
import type { LookupUpdateConfig } from './types';

export function calculateAbandonment(
  releaseResult: ReleaseResult,
  config: LookupUpdateConfig,
): ReleaseResult {
  const { lookupName } = releaseResult;
  const { abandonmentThreshold } = config;
  if (!abandonmentThreshold) {
    logger.trace(
      { lookupName },
      'No abandonmentThreshold defined, skipping abandonment check',
    );
    return releaseResult;
  }

  const abandonmentThresholdMs = toMs(abandonmentThreshold);
  if (!abandonmentThresholdMs) {
    logger.trace(
      { lookupName, abandonmentThreshold },
      'Could not parse abandonmentThreshold to milliseconds, skipping abandonment check',
    );
    return releaseResult;
  }

  const { bumpedAt } = releaseResult;
  if (!bumpedAt) {
    logger.trace(
      { lookupName },
      'No bumpedAt value found, skipping abandonment check',
    );
    return releaseResult;
  }
  const bumpedAtDate = DateTime.fromISO(bumpedAt);

  const abandonmentDate = bumpedAtDate.plus({
    milliseconds: abandonmentThresholdMs,
  });
  const now = DateTime.local();
  const isAbandoned = abandonmentDate < now;
  releaseResult.isAbandoned = isAbandoned;

  logger.trace(
    {
      lookupName,
      bumpedAt,
      abandonmentThreshold,
      abandonmentThresholdMs,
      abandonmentDate: abandonmentDate.toISO(),
      now: now.toISO(),
      isAbandoned,
    },
    'Calculated abandonment status',
  );

  if (isAbandoned) {
    const { datasource, packageName } = config;
    AbandonedPackageStats.write(datasource, packageName, bumpedAt);
  }

  return releaseResult;
}
