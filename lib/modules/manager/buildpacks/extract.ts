import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { parse as parseToml } from '../../../util/toml';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { ProjectDescriptor } from './types';

const dockerPrefix = /^docker:\/\//;

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const descriptor = parseToml(content) as ProjectDescriptor;
    if (
      descriptor.io.buildpacks?.builder &&
      !descriptor.io.buildpacks.builder.startsWith('file://')
    ) {
      const dep = getDep(
        descriptor.io.buildpacks.builder.replace(dockerPrefix, ''),
        true,
        config.registryAliases,
      );
      logger.trace(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Cloud Native Buildpacks builder',
      );

      deps.push(dep);
    }

    if (
      descriptor.io.buildpacks?.group &&
      is.array(descriptor.io.buildpacks.group)
    ) {
      for (const group of descriptor.io.buildpacks.group) {
        if (group.uri && !group.uri.startsWith('file://')) {
          const dep = getDep(
            group.uri.replace(dockerPrefix, ''),
            true,
            config.registryAliases,
          );
          logger.trace(
            {
              depName: dep.depName,
              currentValue: dep.currentValue,
              currentDigest: dep.currentDigest,
            },
            'Cloud Native Buildpack',
          );

          deps.push(dep);
        }
      }
    }
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse buildpacks project descriptor TOML',
    );
    return null;
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
