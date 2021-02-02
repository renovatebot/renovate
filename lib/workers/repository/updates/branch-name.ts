import { clean as cleanGitRef } from 'clean-git-ref';
import hasha from 'hasha';
import slugify from 'slugify';
import { RenovateConfig } from '../../../config/common';
import { logger } from '../../../logger';
import * as template from '../../../util/template';

/**
 * Clean git branch name
 *
 * Remove what clean-git-ref fails to:
 * - leading dot/leading dot after slash
 * - trailing dot
 * - whitespace
 */
function cleanBranchName(branchName: string): string {
  return cleanGitRef(branchName)
    .replace(/^\.|\.$/, '') // leading or trailing dot
    .replace(/\/\./g, '/') // leading dot after slash
    .replace(/\s/g, ''); // whitespace
}

/* eslint-disable no-param-reassign */
export function generateBranchName(update: RenovateConfig): void {
  // Check whether to use a group name
  if (update.groupName) {
    logger.debug('Using group branchName template');
    logger.debug(
      `Dependency ${update.depName} is part of group ${update.groupName}`
    );
    update.groupSlug = slugify(update.groupSlug || update.groupName, {
      lower: true,
    });
    if (update.updateType === 'major' && update.separateMajorMinor) {
      if (update.separateMultipleMajor) {
        const newMajor = String(update.newMajor);
        update.groupSlug = `major-${newMajor}-${update.groupSlug}`;
      } else {
        update.groupSlug = `major-${update.groupSlug}`;
      }
    }
    if (update.updateType === 'patch') {
      update.groupSlug = `patch-${update.groupSlug}`;
    }
    update.branchTopic = update.group.branchTopic || update.branchTopic;
    update.branchName = update.group.branchName || update.branchName;
  }

  if (update.hashedBranchLength) {
    let hashLength = update.hashedBranchLength - update.branchPrefix.length;
    if (hashLength <= 10) {
      logger.warn(
        '`hashedBranchLength` must allow for at least 10 characters hashing in addition to `branchPrefix`. Using 10 character hash instead.'
      );
      hashLength = 10;
    }

    const additionalBranchPrefix = update.additionalBranchPrefix
      ? template.compile(String(update.additionalBranchPrefix), update)
      : '';

    const branchTopic = update.branchTopic
      ? template.compile(String(update.branchTopic), update)
      : '';

    const hash = hasha(additionalBranchPrefix + branchTopic);

    update.branchName = update.branchPrefix + hash.slice(0, hashLength);
  } else {
    update.branchName = template.compile(update.branchName, update);

    // Compile extra times in case of nested templates
    update.branchName = template.compile(update.branchName, update);
    update.branchName = template.compile(update.branchName, update);
  }

  update.branchName = cleanBranchName(update.branchName);
}
