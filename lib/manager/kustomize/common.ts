import { DATASOURCE_GIT_TAGS } from '../../constants/data-binary-source';
import { PackageFile, PackageDependency } from '../common';
import { logger } from '../../logger';
import { safeLoad } from 'js-yaml';

interface Kustomize {
  kind: string;
  bases: string[];
}

// see if there is a version that can be tracked
const versionMatch = /(.*)\?ref=(.*)\s*$/;

// extract the source from a base
const matchSource = /(https:\/\/.*|.+@.+:.*\.git)/;

export function extractBase(base: string): PackageFile | null {
  const isTrackable = versionMatch.exec(base);
  if (isTrackable) {
    const root = isTrackable[1];
    const currentValue = isTrackable[2];
    const rawSource = matchSource.exec(root);
    if (rawSource) {
      const source = rawSource[1];
      return {
        datasource: DATASOURCE_GIT_TAGS,
        depName: root,
        lookupName: source,
        source,
        currentValue,
      };
    }
  }

  return null;
}

export function extractBases(content: string): Kustomize | null {
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
