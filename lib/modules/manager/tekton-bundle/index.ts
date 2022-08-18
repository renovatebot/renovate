import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { ProgrammingLanguage } from '../../../constants';
import { logger } from '../../../logger';
import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency, PackageFile } from '../types';

export const language = ProgrammingLanguage.Docker;

export const defaultConfig = {
  // Tekton uses YAML files to define its kubernetes resources. These
  // don't have a specific file name pattern. To avoid issues with
  // unrelated YAML files, the match pattern is left empty by default.
  // Users must provide this value based on their own Tekton usage.
  // For example, to match all the YAML files in a repository, add
  // the following to renovate.json in the corresponding git repo:
  //  {
  //    "tekton-bundle": {
  //      "fileMatch": ['\\.yaml$', '\\.yml$']
  //    }
  //  }
  fileMatch: [],
};

export const supportedDatasources = [DockerDatasource.id];

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace('tekton-bundle.extractPackageFile()');
  const deps: PackageDependency[] = [];
  let docs: any[];
  try {
    docs = loadAll(content) as any[];
  } catch (err) {
    logger.debug(
      { err, fileName },
      'Failed to parse YAML resource to find tekton-bundle'
    );
    return null;
  }
  for (const doc of docs) {
    deps.push(...getDeps(doc));
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function getDeps(doc: any): PackageDependency[] {
  const deps = [];
  for (const key in doc) {
    const value = doc[key];
    if (key === 'bundle' && is.string(value)) {
      const dep = createDep(value);
      if (dep !== null) {
        logger.trace(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'Tekton bundle dependency found'
        );
        deps.push(dep);
      }
    } else if (is.array(value)) {
      for (const val of value) {
        deps.push(...getDeps(val));
      }
    } else if (is.object(value)) {
      deps.push(...getDeps(value));
    }
  }
  return deps;
}

function createDep(imageRef: string): PackageDependency | null {
  const [repoWithTag, digest] = imageRef.split('@');
  const repoParts = repoWithTag.split('/');
  const repoNameWithTag = repoParts.pop();
  if (!repoNameWithTag) {
    return null;
  }
  const [repoName, tag] = repoNameWithTag.split(':');
  repoParts.push(repoName);
  const repo = repoParts.join('/');

  return {
    autoReplaceStringTemplate:
      '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
    currentDigest: digest,
    // If a tag is not found, assume the lowest possible version. This will
    // ensure the version update is successful, and properly pin the digest.
    currentValue: tag || '0.0',
    datasource: DockerDatasource.id,
    depName: repo,
    depType: 'tekton-bundle',
    replaceString: imageRef,
  };
}
