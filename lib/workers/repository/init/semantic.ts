import conventionalCommitsDetector from 'conventional-commits-detector';
import { logger } from '../../../logger';
import { getCommitMessages } from '../../../util/git';

export async function detectSemanticCommits(): Promise<boolean> {
  logger.debug('detectSemanticCommits()');
  const commitMessages = await getCommitMessages();
  logger.trace(`commitMessages=${JSON.stringify(commitMessages)}`);
  const type = conventionalCommitsDetector(commitMessages);
  logger.debug('Semantic commits detection: ' + type);
  if (type === 'angular') {
    logger.debug('angular semantic commits detected');
    return true;
  }
  logger.debug('No semantic commits detected');
  return false;
}
