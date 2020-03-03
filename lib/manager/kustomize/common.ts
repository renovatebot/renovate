import { safeLoad } from 'js-yaml';
import * as datasourceDocker from '../../datasource/docker';
import * as datasourceGitTags from '../../datasource/git-tags';
import { PackageDependency } from '../common';

interface Image {
  name: string;
  newTag: string;
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

export function extractBase(base: string): PackageDependency | null {
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
      depType: datasourceGitTags.id,
      depName: root,
      lookupName: url,
      source: url,
      currentValue,
    };
  }

  return null;
}

export function extractImage(image: Image): PackageDependency | null {
  if (image && image.name && image.newTag) {
    return {
      datasource: datasourceDocker.id,
      depType: datasourceDocker.id,
      depName: image.name,
      lookupName: image.name,
      source: image.name,
      currentValue: image.newTag,
    };
  }

  return null;
}

export function parseKustomize(content: string): Kustomize | null {
  let pkg = null;
  try {
    pkg = safeLoad(content);
  } catch (e) /* istanbul ignore next */ {
    return null;
  }

  if (!pkg) {
    return null;
  }

  if (pkg.kind !== 'Kustomization') {
    return null;
  }

  pkg.bases = pkg.bases || [];
  pkg.images = pkg.images || [];

  return pkg;
}
