import { logger } from '../../logger/index.ts';
import { getCache } from '../../util/cache/repository/index.ts';
import { regEx } from '../regex.ts';
import { getCommitMessages } from './index.ts';

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
  const type = detect(commitMessages);
  logger.debug(`semanticCommits: detected "${type}"`);
  if (type > 0) {
    logger.debug(`semanticCommits: enabled`);
    cache.semanticCommits = 'enabled';
  } else {
    logger.debug(`semanticCommits: disabled`);
    cache.semanticCommits = 'disabled';
  }
  return cache.semanticCommits;
}

/**
 * Detect semantic commits by counting the number of commit messages that match the Angular convention and comparing it to the number of commit messages that do not match the convention.
 * The Angular convention is defined as: `<type>(<scope>): <description>`, where `<type>` is a word, `<scope>` is an optional word, and `<description>` is a string.
 *
 * @see Inspired by {@link https://github.com/conventional-changelog/conventional-commits-detector|conventional-commits-detector} and {@link https://www.conventionalcommits.org|conventional commits specification}.
 * @param commitMessages commit messages to check
 * @returns A number greater than zero if more semantic commits than non-semantic commits, less than zero if more non-semantic commits than semantic commits, or zero if equal number of semantic and non-semantic commits
 */
function detect(commitMessages: string[]): number {
  const angular = regEx(/^(\w*)(?:\((.*)\))?!?: (.*)$/);

  return commitMessages.reduce((count, message) => {
    if (angular.test(message)) {
      return count + 1;
    }
    return count - 1;
  }, 0);
}
