import { safeLoad } from 'js-yaml';
import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGitHubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import { escapeRegExp, regEx } from '../../util/regex';
import { PackageDependency, PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';
import type { Kustomize, KustomizeImage } from './types';

// URL specifications should follow the hashicorp URL format
// https://github.com/hashicorp/go-getter#url-format
const gitUrl = /^(?:git::)?(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?)?(?<path>(?:[^:/]+[:/])?(?<project>[^/]+\/[^/]+)))(?<subdir>[^?]*)\?ref=(?<currentValue>.+)$/;

export function extractBase(base: string): PackageDependency | null {
  const match = gitUrl.exec(base);

  if (!match) {
    return null;
  }

  if (match?.groups.path.startsWith('github.com')) {
    return {
      currentValue: match.groups.currentValue,
      datasource: datasourceGitHubTags.id,
      depName: match.groups.project.replace('.git', ''),
    };
  }

  return {
    datasource: datasourceGitTags.id,
    depName: match.groups.path.replace('.git', ''),
    lookupName: match.groups.url,
    currentValue: match.groups.currentValue,
  };
}

function createRegex(val: string, digest: string): RegExp {
  const re = `newTag:\\s+['"]?${val}['"]?\\s+digest:\\s+['"]?${digest}['"]?|digest:\\s+['"]?${digest}['"]?\\s+newTag:\\s+['"]?${val}['"]?`;
  // TODO: remove console.warn(re);
  return regEx(re, 's');
}

export function extractImage(
  image: KustomizeImage,
  content: string
): PackageDependency | null {
  if (image?.name) {
    const depName = image.newName ?? image.name;

    // reuse docker extraction
    const res = getDep(depName, false);

    if (res.skipReason) {
      return res;
    }

    // if (image.newTag && image.digest) {
    //   logger.warn({ image }, 'Kustomize: Only one of `newTag` and `digest` are allowed.');
    //   return { ...res, skipReason: SkipReason.InvalidValue };
    // }

    // better autoreplace
    res.replaceString = depName;

    if (image.digest) {
      res.currentDigest = image.digest;
      if (image.newTag) {
        res.currentValue = image.newTag;
        // we have two yaml properties to update, so we need to help autoreplace
        const val = escapeRegExp(image.newTag);
        const digest = escapeRegExp(image.digest);
        const m = createRegex(val, digest).exec(content);
        if (m) {
          res.replaceString = m[0];
          // TODO: remove console.warn(res.replaceString);
        }
      }
    } else if (image.newTag.startsWith('sha256:')) {
      res.currentDigest = image.newTag;
    } else {
      res.currentValue = image.newTag;
    }
    return res;
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
    const dep = extractImage(image, content);
    if (dep) {
      deps.push({ ...dep });
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
