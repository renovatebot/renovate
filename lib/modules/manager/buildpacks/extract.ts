import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { BuildpacksRegistryDatasource } from '../../datasource/buildpacks-registry';
import { isVersion } from '../../versioning/semver';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import {
  type ProjectDescriptor,
  ProjectDescriptorToml,
  isBuildpackByName,
  isBuildpackByURI,
} from './schema';

const dockerPrefix = regEx(/^docker:\/?\//);
const dockerRef = regEx(
  /^((?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*)(?::\d{2,5}\/)?)?[a-z\d]+((\.|_|__|-+)[a-z\d]+)*(\/[a-z\d]+((\.|_|__|-+)[a-z\d]+)*)*(?::(\w[\w.-]{0,127})(?:@sha256:[A-Fa-f\d]{32,})?|@sha256:[A-Fa-f\d]{32,})$/,
);

function isDockerRef(ref: string): boolean {
  if (ref.startsWith('docker:/') || dockerRef.test(ref)) {
    return true;
  }
  return false;
}
const buildpackRegistryPrefix = 'urn:cnb:registry:';
const buildpackRegistryId = regEx(
  /^[a-z0-9\-.]+\/[a-z0-9\-.]+(?:@(?<version>.+))?$/,
);

function isBuildpackRegistryId(ref: string): boolean {
  const bpRegistryMatch = buildpackRegistryId.exec(ref);
  if (!bpRegistryMatch) {
    return false;
  } else if (!bpRegistryMatch.groups?.version) {
    return true;
  }
  return isVersion(bpRegistryMatch.groups.version);
}

function isBuildpackRegistryRef(ref: string): boolean {
  return isBuildpackRegistryId(ref) || ref.startsWith(buildpackRegistryPrefix);
}

function parseProjectToml(
  content: string,
  packageFile: string,
): ProjectDescriptor | null {
  const res = ProjectDescriptorToml.safeParse(content);
  if (res.success) {
    return res.data;
  }

  logger.debug(
    { packageFile, err: res.error },
    'Failed to parse buildpacks project descriptor TOML',
  );

  return null;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  const descriptor = parseProjectToml(content, packageFile);
  if (!descriptor) {
    return null;
  }

  if (
    descriptor.io?.buildpacks?.builder &&
    isDockerRef(descriptor.io.buildpacks.builder)
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

    deps.push({ ...dep, commitMessageTopic: 'builder {{depName}}' });
  }

  if (
    descriptor.io?.buildpacks?.group &&
    is.array(descriptor.io.buildpacks.group)
  ) {
    for (const group of descriptor.io.buildpacks.group) {
      if (isBuildpackByURI(group) && isDockerRef(group.uri)) {
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
      } else if (isBuildpackByURI(group) && isBuildpackRegistryRef(group.uri)) {
        const dependency = group.uri.replace(buildpackRegistryPrefix, '');

        if (dependency.includes('@')) {
          const version = dependency.split('@')[1];
          const dep: PackageDependency = {
            datasource: BuildpacksRegistryDatasource.id,
            currentValue: version,
            packageName: dependency.split('@')[0],
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          };
          deps.push(dep);
        }
      } else if (isBuildpackByName(group)) {
        const version = group.version;

        if (version) {
          const dep: PackageDependency = {
            datasource: BuildpacksRegistryDatasource.id,
            currentValue: version,
            packageName: group.id,
          };
          deps.push(dep);
        }
      }
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
