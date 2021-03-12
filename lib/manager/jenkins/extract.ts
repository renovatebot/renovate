import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import * as datasourceJenkins from '../../datasource/jenkins-plugins';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isSkipComment } from '../../util/ignore';
import * as dockerVersioning from '../../versioning/docker';
import type { PackageDependency, PackageFile } from '../types';

function getDependency(
  name: string,
  version: string,
  url: string,
  groupId: string
): PackageDependency {
  const dep: PackageDependency = {
    datasource: datasourceJenkins.id,
    versioning: dockerVersioning.id,
    depName: name,
  };

  if (version) {
    dep.currentValue = version.toString();
  } else {
    dep.skipReason = SkipReason.NoVersion;
  }

  if (version === 'latest' || version === 'experimental' || groupId) {
    dep.skipReason = SkipReason.UnsupportedVersion;
  }

  if (url) {
    dep.skipReason = SkipReason.InternalPackage;
  }

  logger.debug({ dep }, 'Jenkins plugin dependency');
  return dep;
}

function extractYaml(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];

  try {
    const doc = yaml.safeLoad(content, { json: true }) as any;
    if (doc?.plugins && is.array(doc.plugins)) {
      for (const plugin of doc.plugins) {
        if (plugin.artifactId) {
          // TODO: how can we specify if a dependency should be ignored with yaml ?
          const dep = getDependency(
            plugin.artifactId,
            plugin.source?.version,
            plugin.source?.url,
            plugin.groupId
          );
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error parsing Jenkins plugins');
    return null;
  }
  return deps;
}

function extractText(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const regex = /^\s*(?<depName>[\d\w-]+):(?<currentValue>[^#\s]+)[#\s]*(?<comment>.*)$/;

  for (const line of content.split('\n')) {
    const match = regex.exec(line);

    if (match) {
      const { depName, currentValue, comment } = match.groups;
      const dep = getDependency(depName, currentValue, null, null);

      if (!dep.skipReason && isSkipComment(comment)) {
        dep.skipReason = SkipReason.Ignored;
      }
      deps.push(dep);
    }
  }
  return deps;
}

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace('jenkins.extractPackageFile()');
  const deps: PackageDependency[] = [];

  if (/\.ya?ml$/.test(fileName)) {
    deps.push(...extractYaml(content));
  } else {
    deps.push(...extractText(content));
  }

  return { deps };
}
