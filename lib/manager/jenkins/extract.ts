import yaml from 'js-yaml';
import * as datasourceJenkins from '../../datasource/jenkins-plugins';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isSkipComment } from '../../util/ignore';
import * as dockerVersioning from '../../versioning/docker';
import type { PackageDependency, PackageFile } from '../types';
import type { JenkinsPlugin, JenkinsPlugins } from './types';

const YamlExtension = /\.ya?ml$/;

function getDependency(plugin: JenkinsPlugin): PackageDependency {
  const dep: PackageDependency = {
    datasource: datasourceJenkins.id,
    versioning: dockerVersioning.id,
    depName: plugin.artifactId,
  };

  if (plugin.source?.version) {
    dep.currentValue = plugin.source.version.toString();
    if (typeof plugin.source.version !== 'string') {
      dep.skipReason = SkipReason.InvalidVersion;
      logger.warn(
        { dep },
        'Jenkins plugin dependency version is not a string and will be ignored'
      );
    }
  } else {
    dep.skipReason = SkipReason.NoVersion;
  }

  if (
    plugin.source?.version === 'latest' ||
    plugin.source?.version === 'experimental' ||
    plugin.groupId
  ) {
    dep.skipReason = SkipReason.UnsupportedVersion;
  }

  if (plugin.source?.url) {
    dep.skipReason = SkipReason.InternalPackage;
  }

  if (!dep.skipReason && plugin.renovate?.ignore) {
    dep.skipReason = SkipReason.Ignored;
  }

  logger.debug({ dep }, 'Jenkins plugin dependency');
  return dep;
}

function extractYaml(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];

  try {
    const doc = yaml.safeLoad(content, { json: true }) as JenkinsPlugins;
    if (doc?.plugins) {
      for (const plugin of doc.plugins) {
        if (plugin.artifactId) {
          const dep = getDependency(plugin);
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error parsing Jenkins plugins');
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
      const plugin: JenkinsPlugin = {
        artifactId: depName,
        source: {
          version: currentValue,
        },
        renovate: {
          ignore: isSkipComment(comment),
        },
      };
      const dep = getDependency(plugin);
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

  if (YamlExtension.test(fileName)) {
    deps.push(...extractYaml(content));
  } else {
    deps.push(...extractText(content));
  }

  if (deps.length === 0) {
    return null;
  }
  return { deps };
}
