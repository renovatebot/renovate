import conventionalCommitsDetector from 'conventional-commits-detector';
import { logger } from '../../logger';
import { getCache } from '../../util/cache/repository';
import { getCommitMessages } from '.';

type DetectedSemanticCommit = 'enabled' | 'disabled';

export async function detectSemanticCommits(): Promise<DetectedSemanticCommit> {
  logger.debug('detectSemanticCommits()');
  const cache = getCache();
  if (cache.semanticCommits) {
    logger.debug(
      `semanticCommits: returning "${cache.semanticCommits}" from cache`,
    );
    return cache.semanticCommits;
  }
  const commitMessages = await getCommitMessages();
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  logger.debug(`semanticCommits: detected "${type}"`);
  if (type === 'angular') {
    logger.debug(`semanticCommits: enabled`);
    cache.semanticCommits = 'enabled';
  } else {
    logger.debug(`semanticCommits: disabled`);
    cache.semanticCommits = 'disabled';
  }
  return cache.semanticCommits;
}
