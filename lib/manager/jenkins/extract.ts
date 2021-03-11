import * as datasourceJenkins from '../../datasource/jenkins-plugins';
import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isSkipComment } from '../../util/ignore';
import * as dockerVersioning from '../../versioning/docker';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace('jenkins.extractPackageFile()');
  let deps: PackageDependency[] = [];

  if (/\.ya?ml$/.test(fileName)) {
    deps = extractYaml(content);
  } else {
    deps = extractText(content);
  }

  if (deps == null) return null;

  return { deps };
}

function extractYaml(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];

  try {
    const doc = yaml.safeLoad(content, { json: true }) as any;
    if (doc?.plugins && is.array(doc.plugins)) {
      for (const plugin of doc.plugins) {
        if (plugin.artifactId) {
          //TODO: how can we specify if a dependency should be ignored with yaml ?
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

function getDependency(
  name: string,
  version: string,
  url: string,
  groupId: string
): PackageDependency {
  const dep: PackageDependency = {
    datasource: datasourceJenkins.id,
    versioning: dockerVersioning.id, // Not so sure about this, how can we instruct renovate to replace a specifc property for yaml ?
    depName: name,
    currentValue: version,
  };

  if (!version) {
    dep.skipReason = SkipReason.NoVersion;
  }

  if (version == 'latest' || version == 'experimental' || groupId) {
    dep.skipReason = SkipReason.UnsupportedVersion;
  }

  if (url) {
    dep.skipReason = SkipReason.InternalPackage;
  }

  return dep;
}
