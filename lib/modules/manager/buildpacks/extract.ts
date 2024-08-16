import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { type ProjectDescriptor, ProjectDescriptorToml } from './schema';

const dockerPrefix = /^docker:\/\//;

function parseProjectToml(content: string): ProjectDescriptor | null {
  let res = ProjectDescriptorToml.safeParse(content);
  if (res.success) {
    return res.data;
  }

  logger.debug(res.error, 'Failed to parse buildpacks project descriptor TOML');

  return null;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  const descriptor = parseProjectToml(content);
  if (!descriptor) {
    return null;
  }

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

  if (!deps.length) {
    return null;
  }
  return { deps };
}
