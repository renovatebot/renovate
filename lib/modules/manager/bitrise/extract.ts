import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { parseSingleYaml } from '../../../util/yaml';
import type { PackageDependency, PackageFileContent } from '../types';
import { BitriseFile } from './schema';
import { parseStep } from './utils';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  try {
    const parsed = parseSingleYaml(content, {
      customSchema: BitriseFile,
    });

    const workflows = Object.values(parsed.workflows);
    for (const workflow of workflows) {
      const steps = workflow.steps.flatMap((step) => Object.keys(step));
      for (const step of steps) {
        const dep = parseStep(step, parsed.default_step_lib_source);

        if (!is.nullOrUndefined(dep)) {
          deps.push(dep);
        }
      }
    }
  } catch (err) {
    logger.debug({ err, packageFile }, `Failed to parse Bitrise YAML config`);
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
