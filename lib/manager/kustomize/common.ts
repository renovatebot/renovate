import { DATASOURCE_GIT_TAGS } from '../../constants/data-binary-source';
import { PackageFile, PackageDependency } from '../common';
import { logger } from '../../logger';
import { safeLoad } from 'js-yaml';

interface Kustomize {
  kind: string;
  bases: string[];
}

// extract the version from the url
const versionMatch = /(?<basename>.*)\?ref=(?<version>.*)\s*$/;

// extract the url from the base of a url with a subdir
const extractUrl = /^(?<url>.*)(?:\/\/.*)$/;

export function extractBase(base: string): PackageFile | null {
  const basenameVersion = versionMatch.exec(base);
  if (basenameVersion) {
    const currentValue = basenameVersion.groups.version;
    const root = basenameVersion.groups.basename;

    const urlResult = extractUrl.exec(root);
    var url = root;
    // if a match, then there was a subdir, update
    if (urlResult && !url.startsWith('http')) {
      url = urlResult.groups.url;
    }

    return {
      datasource: DATASOURCE_GIT_TAGS,
      depName: root,
      lookupName: url,
      source: url,
      currentValue,
    };
  }

  return null;
}

export function parseKustomize(content: string): Kustomize | null {
  var pkg = null;
  try {
    pkg = safeLoad(content);
  } catch (e) {
    logger.trace('kustomize.extractBases(): skipping, invalid yaml');
    return null;
  }

  if (!pkg) {
    return null;
  }

  if (pkg.kind !== 'Kustomization') {
    return null;
  }

  if (!pkg.bases) {
    return null;
  }

  return pkg;
}
