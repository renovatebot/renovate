import { isNonEmptyArray } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { getToolConfig } from '../../../util/exec/containerbase.ts';
import { isToolName } from '../../../util/exec/types.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { RenovateJson } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const config = RenovateJson.safeParse(content);
  if (!config.success) {
    logger.debug({ packageFile, err: config.error }, 'Invalid Renovate Config');
    return null;
  }

  const deps: PackageDependency[] = [];
  if (!config.data.constraints) {
    logger.debug({ packageFile, err: config.error }, 'No constraints');
    return null;
  }

  for (const [constraint, value] of Object.entries(config.data.constraints)) {
    if (isToolName(constraint)) {
      const toolConfig = getToolConfig(constraint);
      deps.push({
        ...toolConfig,
        currentValue: value,
        depType: 'tool-constraint',
      });
    } else {
      deps.push({
        depName: constraint,
        currentValue: value,
        skipReason: 'unsupported',
        depType: 'constraint',
      });
    }
  }

  return isNonEmptyArray(deps) ? { deps } : null;
}
