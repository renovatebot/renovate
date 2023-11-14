import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { isSkipComment } from '../../../util/ignore';
import { newlineRegex, regEx } from '../../../util/regex';
import { JenkinsPluginsDatasource } from '../../datasource/jenkins-plugins';
import * as mavenVersioning from '../../versioning/maven';
import type { PackageDependency, PackageFileContent } from '../types';
import type { JenkinsPlugin, JenkinsPlugins } from './types';

const YamlExtension = regEx(/\.ya?ml$/);

function getDependency(plugin: JenkinsPlugin): PackageDependency {
  const dep: PackageDependency = {
    datasource: JenkinsPluginsDatasource.id,
    versioning: mavenVersioning.id,
    depName: plugin.artifactId,
  };

  if (plugin.source?.version) {
    dep.currentValue = plugin.source.version.toString();
    if (!is.string(plugin.source.version)) {
      dep.skipReason = 'invalid-version';
      logger.warn(
        { dep },
        'Jenkins plugin dependency version is not a string and will be ignored',
      );
    }
  } else {
    dep.skipReason = 'unspecified-version';
  }

  if (
    plugin.source?.version === 'latest' ||
    plugin.source?.version === 'experimental' ||
    plugin.groupId
  ) {
    dep.skipReason = 'unsupported-version';
  }

  if (plugin.source?.url) {
    dep.skipReason = 'internal-package';
  }

  if (!dep.skipReason && plugin.renovate?.ignore) {
    dep.skipReason = 'ignored';
  }

  logger.debug({ dep }, 'Jenkins plugin dependency');
  return dep;
}

function extractYaml(
  content: string,
  packageFile: string,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  try {
    const doc = load(content, { json: true }) as JenkinsPlugins;
    if (is.nonEmptyArray(doc?.plugins)) {
      for (const plugin of doc.plugins) {
        if (plugin.artifactId) {
          const dep = getDependency(plugin);
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error parsing Jenkins plugins');
  }
  return deps;
}

function extractText(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const regex = regEx(
    /^\s*(?<depName>[\d\w-]+):(?<currentValue>[^#\s]+)[#\s]*(?<comment>.*)$/,
  );

  for (const line of content.split(newlineRegex)) {
    const match = regex.exec(line);
    if (match?.groups) {
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
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`jenkins.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];

  if (YamlExtension.test(packageFile)) {
    deps.push(...extractYaml(content, packageFile));
  } else {
    deps.push(...extractText(content));
  }

  if (deps.length === 0) {
    return null;
  }
  return { deps };
}
