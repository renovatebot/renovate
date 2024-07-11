import { parseSingleYaml } from '../../../util/yaml';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { BitriseFile } from './schema';
import { logger } from '../../../logger';
import { parseStep } from './utils';
import is from '@sindresorhus/is';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  try {


    const parsed = parseSingleYaml(content, {
      customSchema: BitriseFile,
    });

    const workflows = Object.values(parsed.workflows)
    for (const workflow of workflows) {
      const steps = workflow.steps.flatMap((step) => Object.keys(step))
      for (const step of steps) {
        const dep = parseStep(step);

        if (!is.nullOrUndefined(dep)) {
          deps.push(dep);
        }
      }
    }

  } catch (err) {
    logger.debug(
      { err, packageFile },
      `Parsing Bitrise config YAML failed`,
    );
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
