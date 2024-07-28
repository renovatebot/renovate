import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { parseSingleYaml } from '../../../util/yaml';
import { OrbDatasource } from '../../datasource/orb';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import { CircleCiFile } from './schema';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const parsed = parseSingleYaml(content, {
      customSchema: CircleCiFile,
    });

    for (const [key, orb] of Object.entries(parsed.orbs ?? {})) {
      const [packageName, currentValue] = orb.split('@');

      deps.push({
        depName: key,
        packageName,
        depType: 'orb',
        currentValue,
        versioning: npmVersioning.id,
        datasource: OrbDatasource.id,
      });
    }

    for (const job of Object.values(parsed.jobs ?? {})) {
      for (const dockerElement of coerceArray(job.docker)) {
        deps.push({
          ...getDep(dockerElement.image),
          depType: 'docker',
        });
      }
    }

    for (const alias of coerceArray(parsed.aliases)) {
      deps.push({
        ...getDep(alias.image),
        depType: 'docker',
      });
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting circleci images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
