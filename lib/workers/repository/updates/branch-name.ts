// TODO #7154
import cleanGitRef from 'clean-git-ref';
import hasha from 'hasha';
import slugify from 'slugify';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import * as template from '../../../util/template';

const MIN_HASH_LENGTH = 6;

const RE_MULTIPLE_DASH = regEx(/--+/g);

const RE_SPECIAL_CHARS_STRICT = regEx(/[`~!@#$%^&*()_=+[\]\\|{};':",.<>?]/g);

/**
 * Clean git branch name
 *
 * Remove what clean-git-ref fails to:
 * - leading dot/leading dot after slash
 * - trailing dot
 * - whitespace
 * - special characters
 * - leading or trailing dashes
 * - chained dashes(breaks markdown comments) are replaced by single dash
 */
function cleanBranchName(
  branchName: string,
  branchNameStrict?: boolean
): string {
  let cleanedBranchName = branchName;

  if (branchNameStrict) {
    cleanedBranchName = cleanedBranchName.replace(RE_SPECIAL_CHARS_STRICT, '-'); // massage out all special characters that slip through slugify
  }

  return cleanGitRef
    .clean(cleanedBranchName)
    .replace(regEx(/^\.|\.$/), '') // leading or trailing dot
    .replace(regEx(/\/\./g), '/') // leading dot after slash
    .replace(regEx(/\s/g), '') // whitespace
    .replace(regEx(/[[\]?:\\^~]/g), '-') // massage out all these characters: [ ] ? : \ ^ ~
    .replace(regEx(/(^|\/)-+/g), '$1') // leading dashes
    .replace(regEx(/-+(\/|$)/g), '$1') // trailing dashes
    .replace(RE_MULTIPLE_DASH, '-'); // chained dashes
}

export function generateBranchName(update: RenovateConfig): void {
  // Check whether to use a group name
  if (update.groupName) {
    logger.debug('Using group branchName template');
    // TODO: types (#7154)
    logger.debug(
      `Dependency ${update.depName!} is part of group ${update.groupName}`
    );
    update.groupSlug = slugify(update.groupSlug ?? update.groupName, {
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
    if (update.updateType === 'patch' && update.separateMinorPatch) {
      update.groupSlug = `patch-${update.groupSlug}`;
    }
    update.branchTopic = update.group!.branchTopic ?? update.branchTopic;
    update.branchName = update.group!.branchName ?? update.branchName;
  }

  if (update.hashedBranchLength) {
    let hashLength = update.hashedBranchLength - update.branchPrefix!.length;
    if (hashLength < MIN_HASH_LENGTH) {
      logger.warn(
        `\`hashedBranchLength\` must allow for at least ${MIN_HASH_LENGTH} characters hashing in addition to \`branchPrefix\`. Using ${MIN_HASH_LENGTH} character hash instead.`
      );
      hashLength = MIN_HASH_LENGTH;
    }

    const additionalBranchPrefix = template.compile(
      String(update.additionalBranchPrefix ?? ''),
      update
    );

    const branchTopic = template.compile(
      String(update.branchTopic ?? ''),
      update
    );

    let hashInput = additionalBranchPrefix + branchTopic;

    // Compile extra times in case of nested templates
    hashInput = template.compile(hashInput, update);
    hashInput = template.compile(hashInput, update);

    const hash = hasha(hashInput);

    // TODO: types (#7154)
    update.branchName = `${update.branchPrefix!}${hash.slice(0, hashLength)}`;
  } else {
    update.branchName = template.compile(update.branchName!, update);

    // Compile extra times in case of nested templates
    update.branchName = template.compile(update.branchName, update);
    update.branchName = template.compile(update.branchName, update);
  }

  update.branchName = cleanBranchName(
    update.branchName,
    update.branchNameStrict
  );
}
