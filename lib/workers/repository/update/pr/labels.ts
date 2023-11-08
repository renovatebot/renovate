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
    .filter(is.nonEmptyStringAndNotWhitespace);
}

export function getChangedLabels(
  oldLabels: string[],
  newLabels: string[],
): [string[] | null, string[] | null] {
  const labelsToAdd = newLabels?.filter((l) => !oldLabels?.includes(l));
  const labelsToRemove = oldLabels?.filter((l) => !newLabels?.includes(l));

  return [labelsToAdd, labelsToRemove];
}

export function areLabelsModified(
  labelsFromDebugData: string[],
  labelsInPr: string[],
): boolean {
  const modified = !dequal(labelsFromDebugData.sort(), labelsInPr.sort());

  if (modified) {
    logger.debug(
      'PR labels have been modified by user, skipping labels update',
    );
  }

  return modified;
}

export function shouldUpdateLabels(
  labelsInDebugData: string[] | undefined,
  labelsInPr: string[] | undefined,
  newLabels: string[] | undefined,
): boolean {
  if (!is.array(labelsInDebugData)) {
    logger.debug({ labelsInDebugData }, 'No labels in PR');
    return false;
  }

  if (areLabelsModified(labelsInDebugData, labelsInPr ?? [])) {
    logger.debug(
      { labelsInDebugData, labelsInPr },
      'Labels in PR have been modified by user',
    );
    return false;
  }

  if (dequal((newLabels ?? []).sort(), labelsInDebugData.sort())) {
    logger.debug(
      { newLabels, existingLabels: labelsInDebugData },
      'New labels and existing labels are same',
    );
    return false;
  }

  return true;
}
