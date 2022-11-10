import { dump, load } from 'js-yaml';
import { logger } from '../../../logger';
import type { UpdateDependencyConfig } from '../types';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, newValue } = upgrade;
  let parsedContent: any = null;
  let npmDepends: any = null;
  let changed = false;

  try {
    parsedContent = load(fileContent);
    npmDepends = parsedContent.spec.services;
  } catch (err) {
    logger.error(err, 'Failed to parse OAM version definition.');
    return null;
  }

  Object.values(npmDepends).forEach((npmDepend) => {
    const dep: any = npmDepend;
    if (dep.packageName === depName && dep.image.tag !== newValue) {
      dep.image.tag = newValue;
      changed = true;
    }
  });

  if (changed) {
    return dump(parsedContent);
  }

  return null;
}
