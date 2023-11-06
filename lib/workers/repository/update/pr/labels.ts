import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../config/types';
import * as template from '../../../../util/template';
import { dequal } from 'dequal';
import { logger } from '../../../../logger';
import { id } from 'common-tags';

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
  newLabels: string[]
): [string[] | null, string[] | null] {
  const labelsToAdd = newLabels?.filter((l) => !oldLabels?.includes(l));
  const labelsToRemove = oldLabels?.filter((l) => !newLabels?.includes(l));

  return [labelsToAdd, labelsToRemove];
}

export function areLabelsModified(
  oldLabels: string[],
  newLabels?: string[]
): boolean {
  const modified = !dequal(oldLabels.sort(), newLabels?.sort());

  if (modified) {
    logger.debug(
      'PR labels have been modified by user, skipping labels update'
    );
  }

  return modified;
}

export function shouldUpdateLabels(
  labelsInDebugData?: string[],
  labelsInPr?: string[],
  newLabels?: string[]
): boolean {
  if (!labelsInDebugData) {
    return false;
  }

  if (areLabelsModified(labelsInDebugData, labelsInPr)) {
    return false;
  }

  if (dequal((newLabels ?? []).sort(), labelsInDebugData.sort())) {
    return false;
  }

  return true;
}
