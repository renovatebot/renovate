import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { Pr } from '../../../../modules/platform/types';

const REOPEN_THRESHOLD_MILLIS = 1000 * 60 * 60 * 24 * 7;

export async function tryReuseBranchPr(branchName: string): Promise<Pr | null> {
  if (!platform.tryReuseBranchPr) {
    return null;
  }

  const autoclosedPr = await platform.findPr({ branchName, state: 'closed' });
  if (!autoclosedPr) {
    return null;
  }

  if (!autoclosedPr.title.endsWith(' - autoclosed')) {
    return null;
  }

  const closedAt = autoclosedPr.closedAt;
  if (!closedAt) {
    return null;
  }

  const closedMillisAgo = DateTime.fromISO(closedAt)
    .diffNow()
    .negate()
    .toMillis();
  if (closedMillisAgo > REOPEN_THRESHOLD_MILLIS) {
    logger.debug(`Found autoclosed PR ${autoclosedPr.number} but it is too old to reopen`);
    return null;
  }

  logger.debug({ autoclosedPr }, 'Found autoclosed PR for branch');

  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would try to reopen autoclosed PR');
    return null;
  }

  try {
    const pr = await platform.tryReuseBranchPr(autoclosedPr, branchName);
    return pr;
  } catch (err) {
    logger.debug(
      { err },
      `Error trying to reuse existing PR with branch=${branchName}`,
    );
    return null;
  }
}
