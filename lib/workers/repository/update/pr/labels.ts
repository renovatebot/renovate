import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { toBase64 } from '../../../../util/string';
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
  newLabels: string[]
): [string[] | null, string[] | null] {
  const labelsToAdd = newLabels?.filter((l) => !oldLabels?.includes(l));
  const labelsToRemove = oldLabels?.filter((l) => !newLabels?.includes(l));

  return [labelsToAdd, labelsToRemove];
}

export function areLabelsModified(
  oldLabelsHash: string,
  existingLabels?: string[]
): boolean {
  const existingLabelsHash = toBase64(
    JSON.stringify(existingLabels?.sort() ?? [])
  );
  if (existingLabelsHash !== oldLabelsHash) {
    logger.debug(
      'PR labels have been modified by user, skipping labels update'
    );
    return true;
  }

  return false;
}
