import { clean as cleanGitRef } from 'clean-git-ref';
import slugify from 'slugify';
import { RenovateConfig } from '../../../config/common';
import { logger } from '../../../logger';
import { clone } from '../../../util/clone';
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

export function getBranchName(update_: RenovateConfig): string {
  const update = clone(update_);
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
      update.groupSlug = `major-${update.newMajor}-${update.groupSlug}`;
    }
    if (update.updateType === 'patch') {
      update.groupSlug = `patch-${update.groupSlug}`;
    }
    update.branchTopic = update.group.branchTopic || update.branchTopic;
    update.branchName = template.compile(
      update.group.branchName || update.branchName,
      update
    );
  } else {
    update.branchName = template.compile(update.branchName, update);
  }
  // Compile extra times in case of nested templates
  update.branchName = template.compile(update.branchName, update);
  update.branchName = cleanBranchName(
    template.compile(update.branchName, update)
  );
  return update.branchName;
}
