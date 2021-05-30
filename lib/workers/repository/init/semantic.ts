import conventionalCommitsDetector from 'conventional-commits-detector';
import { logger } from '../../../logger';
import { getCache } from '../../../util/cache/repository';
import { getCommitMessages } from '../../../util/git';

type DetectedSemanticCommit = 'enabled' | 'disabled';

export async function detectSemanticCommits(): Promise<DetectedSemanticCommit> {
  logger.debug('detectSemanticCommits()');
  const cache = getCache();
  if (cache.semanticCommits) {
    return cache.semanticCommits;
  }
  const commitMessages = await getCommitMessages();
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  logger.debug('Semantic commits detection: ' + type);
  if (type === 'angular') {
    logger.debug('angular semantic commits detected');
    cache.semanticCommits = 'enabled';
  } else {
    logger.debug('No semantic commits detected');
    cache.semanticCommits = 'disabled';
  }
  return cache.semanticCommits;
}
