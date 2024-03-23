import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import { parseSingleYaml } from '../../../util/yaml';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry } from '../helmv3/utils';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { HelmChart, Image, Kustomize } from './types';

// URL specifications should follow the hashicorp URL format
// https://github.com/hashicorp/go-getter#url-format
const gitUrl = regEx(
  /^(?:git::)?(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?)?(?<path>(?:[^:/\s]+(?::[0-9]+)?[:/])?(?<project>[^/\s]+\/[^/\s]+)))(?<subdir>[^?\s]*)\?ref=(?<currentValue>.+)$/,
);
// regex to match URLs with ".git" delimiter
const dotGitRegex = regEx(
  /^(?:git::)?(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?)?(?<path>(?:[^:/\s]+(?::[0-9]+)?[:/])?(?<project>[^?\s]*(\.git))))(?<subdir>[^?\s]*)\?ref=(?<currentValue>.+)$/,
);
// regex to match URLs with "_git" delimiter
const underscoreGitRegex = regEx(
  /^(?:git::)?(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?)?(?<path>(?:[^:/\s]+(?::[0-9]+)?[:/])?(?<project>[^?\s]*)(_git\/[^/\s]+)))(?<subdir>[^?\s]*)\?ref=(?<currentValue>.+)$/,
);
// regex to match URLs having an extra "//"
const gitUrlWithPath = regEx(
  /^(?:git::)?(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?)?(?<path>(?:[^:/\s]+(?::[0-9]+)?[:/])(?<project>[^?\s]+)))(?:\/\/)(?<subdir>[^?\s]+)\?ref=(?<currentValue>.+)$/,
);

export function extractResource(base: string): PackageDependency | null {
  let match: RegExpExecArray | null;

  if (base.includes('_git')) {
    match = underscoreGitRegex.exec(base);
  } else if (base.includes('.git')) {
    match = dotGitRegex.exec(base);
  } else if (gitUrlWithPath.test(base)) {
    match = gitUrlWithPath.exec(base);
  } else {
    match = gitUrl.exec(base);
  }

  if (!match?.groups) {
    return null;
  }

  const { path } = match.groups;
  if (regEx(/(?:github\.com)(:|\/)/).test(path)) {
    return {
      currentValue: match.groups.currentValue,
      datasource: GithubTagsDatasource.id,
      depName: match.groups.project.replace('.git', ''),
    };
  }

  return {
    datasource: GitTagsDatasource.id,
    depName: path.replace('.git', ''),
    packageName: match.groups.url,
    currentValue: match.groups.currentValue,
  };
}

export function extractImage(
  image: Image,
  aliases?: Record<string, string> | undefined,
): PackageDependency | null {
  if (!image.name) {
    return null;
  }
  const nameToSplit = image.newName ?? image.name;
  if (!is.string(nameToSplit)) {
    logger.debug({ image }, 'Invalid image name');
    return null;
  }
  const nameDep = getDep(nameToSplit, false, aliases);
  const { depName } = nameDep;
  const { digest, newTag } = image;
  if (digest && newTag) {
    logger.debug(
      { newTag, digest },
      'Kustomize ignores newTag when digest is provided. Pick one, or use `newTag: tag@digest`',
    );
    return {
      depName,
      currentValue: newTag,
      currentDigest: digest,
      skipReason: 'invalid-dependency-specification',
    };
  }

  if (digest) {
    if (!is.string(digest) || !digest.startsWith('sha256:')) {
      return {
        depName,
        currentValue: digest,
        skipReason: 'invalid-value',
      };
    }

    return {
      ...nameDep,
      currentDigest: digest,
      replaceString: digest,
    };
  }

  if (newTag) {
    if (!is.string(newTag) || newTag.startsWith('sha256:')) {
      return {
        depName,
        currentValue: newTag,
        skipReason: 'invalid-value',
      };
    }

    const dep = getDep(`${depName}:${newTag}`, false, aliases);
    return {
      ...dep,
      replaceString: newTag,
      autoReplaceStringTemplate:
        '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
    };
  }

  if (image.newName) {
    return {
      ...nameDep,
      replaceString: image.newName,
    };
  }

  return null;
}

export function extractHelmChart(
  helmChart: HelmChart,
  aliases?: Record<string, string> | undefined,
): PackageDependency | null {
  if (!helmChart.name) {
    return null;
  }

  if (isOCIRegistry(helmChart.repo)) {
    const dep = getDep(
      `${helmChart.repo.replace('oci://', '')}/${helmChart.name}:${helmChart.version}`,
      false,
      aliases,
    );
    return {
      ...dep,
      depName: helmChart.name,
      packageName: dep.depName,
      // https://github.com/helm/helm/issues/10312
      // https://github.com/helm/helm/issues/10678
      pinDigests: false,
    };
  }

  return {
    depName: helmChart.name,
    currentValue: helmChart.version,
    registryUrls: [helmChart.repo],
    datasource: HelmDatasource.id,
  };
}

export function parseKustomize(
  content: string,
  packageFile?: string,
): Kustomize | null {
  let pkg: Kustomize | null = null;
  try {
    // TODO: use schema (#9610)
    pkg = parseSingleYaml(content, { json: true });
  } catch (e) /* istanbul ignore next */ {
    logger.debug({ packageFile }, 'Error parsing kustomize file');
    return null;
  }

  if (!pkg || is.string(pkg)) {
    return null;
  }

  pkg.kind ??= 'Kustomization';

  if (!['Kustomization', 'Component'].includes(pkg.kind)) {
    return null;
  }

  return pkg;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  logger.trace(`kustomize.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];

  const pkg = parseKustomize(content, packageFile);
  if (!pkg) {
    return null;
  }

  // grab the remote bases
  for (const base of coerceArray(pkg.bases).filter(is.string)) {
    const dep = extractResource(base);
    if (dep) {
      deps.push({
        ...dep,
        depType: pkg.kind,
      });
    }
  }

  // grab the remote resources
  for (const resource of coerceArray(pkg.resources).filter(is.string)) {
    const dep = extractResource(resource);
    if (dep) {
      deps.push({
        ...dep,
        depType: pkg.kind,
      });
    }
  }

  // grab the remote components
  for (const component of coerceArray(pkg.components).filter(is.string)) {
    const dep = extractResource(component);
    if (dep) {
      deps.push({
        ...dep,
        depType: pkg.kind,
      });
    }
  }

  // grab the image tags
  for (const image of coerceArray(pkg.images)) {
    const dep = extractImage(image, config.registryAliases);
    if (dep) {
      deps.push({
        ...dep,
        depType: pkg.kind,
      });
    }
  }

  // grab the helm charts
  for (const helmChart of coerceArray(pkg.helmCharts)) {
    const dep = extractHelmChart(helmChart, config.registryAliases);
    if (dep) {
      deps.push({
        ...dep,
        depType: 'HelmChart',
      });
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
