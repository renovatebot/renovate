import { safeLoad } from 'js-yaml';
import * as datasourceDocker from '../../datasource/docker';
import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGitHubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import * as dockerVersioning from '../../versioning/docker';
import { PackageDependency, PackageFile } from '../common';

interface Image {
  name: string;
  newTag: string;
  newName?: string;
}

interface Kustomize {
  kind: string;
  bases: string[];
  images: Image[];
}

// extract the version from the url
const versionMatch = /(?<basename>.*)\?ref=(?<version>.*)\s*$/;

// extract the url from the base of a url with a subdir
const extractUrl = /^(?<url>.*)(?:\/\/.*)$/;

// extract github repository information
const githubUrl = /^.*github\.com[:/](?<project>[^/]+\/[^/]+)[^?]*\?ref=(?<currentValue>.+)$/;

export function extractBase(base: string): PackageDependency | null {
  const githubMatch = githubUrl.exec(base);

  if (githubMatch?.groups) {
    const project = githubMatch.groups.project.replace('.git', '').split('/');

    return {
      currentValue: githubMatch.groups.currentValue,
      datasource: datasourceGitHubTags.id,
      depName: `${project[0]}/${project[1]}`,
      depType: 'github',
    };
  }

  const basenameVersion = versionMatch.exec(base);
  if (basenameVersion) {
    const currentValue = basenameVersion.groups.version;
    const root = basenameVersion.groups.basename;

    const urlResult = extractUrl.exec(root);
    let url = root;
    // if a match, then there was a subdir, update
    if (urlResult && !url.startsWith('http')) {
      url = urlResult.groups.url;
    }

    return {
      datasource: datasourceGitTags.id,
      depName: root,
      depType: 'gitTags',
      lookupName: url,
      currentValue,
    };
  }

  return null;
}

export function extractImage(image: Image): PackageDependency | null {
  if (image?.name && image.newTag) {
    return {
      datasource: datasourceDocker.id,
      versioning: dockerVersioning.id,
      depName: image.newName ?? image.name,
      currentValue: image.newTag,
    };
  }

  return null;
}

export function parseKustomize(content: string): Kustomize | null {
  let pkg = null;
  try {
    pkg = safeLoad(content, { json: true });
  } catch (e) /* istanbul ignore next */ {
    return null;
  }

  if (!pkg) {
    return null;
  }

  if (pkg.kind !== 'Kustomization') {
    return null;
  }

  pkg.bases = (pkg.bases || []).concat(pkg.resources || []);
  pkg.images = pkg.images || [];

  return pkg;
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('kustomize.extractPackageFile()');
  const deps: PackageDependency[] = [];

  const pkg = parseKustomize(content);
  if (!pkg) {
    return null;
  }

  // grab the remote bases
  for (const base of pkg.bases) {
    const dep = extractBase(base);
    if (dep) {
      deps.push(dep);
    }
  }

  // grab the image tags
  for (const image of pkg.images) {
    const dep = extractImage(image);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
