import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import * as template from '../../../../util/template';

export function prepareLabels(config: RenovateConfig): string[] {
  const labels = config.labels ?? [];
  const addLabels = config.addLabels ?? [];
  return [...new Set([...labels, ...addLabels])]
    .filter(is.nonEmptyStringAndNotWhitespace)
    .map((label) => template.compile(label, config))
    .filter(is.nonEmptyStringAndNotWhitespace)
    .sort();
}

/**
 * Determine changed labels between old and new label arrays.
 *
 * This function takes two arrays of labels, 'oldLabels' and 'newLabels', and calculates the labels
 * that need to be added and removed to transition from 'oldLabels' to 'newLabels'.
 */
export function getChangedLabels(
  oldLabels: string[] | undefined,
  newLabels: string[] | undefined,
): [string[] | undefined, string[] | undefined] {
  const labelsToAdd = newLabels?.filter((l) => !oldLabels?.includes(l));
  const labelsToRemove = oldLabels?.filter((l) => !newLabels?.includes(l));

  return [labelsToAdd, labelsToRemove];
}

/**
 * Check if labels in the PR have been modified.
 *
 * This function compares two arrays of labels, 'prInitialLabels' and 'prCurrentLabels',
 * to determine if they are different, indicating that labels in the PR have been modified.
 */
export function areLabelsModified(
  prInitialLabels: string[],
  prCurrentLabels: string[],
): boolean {
  const modified = !dequal(prInitialLabels.sort(), prCurrentLabels.sort());

  if (modified) {
    logger.debug(
      { prInitialLabels, prCurrentLabels },
      'PR labels have been modified by user, skipping labels update',
    );
  }

  return modified;
}

/**
 * Determine if labels should be updated in the Pull Request.
 */
export function shouldUpdateLabels(
  prInitialLabels: string[] | undefined,
  prCurrentLabels: string[] | undefined,
  configuredLabels: string[] | undefined,
): boolean {
  // If the 'labelsInDebugData' field is undefined
  // it means the PR was created before the update-labels logic was merged, and labels should not be updated.
  //  Reference: https://github.com/renovatebot/renovate/pull/25340
  if (!is.array(prInitialLabels)) {
    return false;
  }

  // If the labels are unchanged, they should not be updated
  if (dequal((configuredLabels ?? []).sort(), prInitialLabels.sort())) {
    return false;
  }

  // If the labels in the PR have been modified by the user, they should not be updated
  if (areLabelsModified(prInitialLabels, prCurrentLabels ?? [])) {
    logger.debug('Labels have been modified by user - skipping labels update.');
    return false;
  }

  logger.debug('Labels have been changed in repo config- updating labels.');
  return true;
}
