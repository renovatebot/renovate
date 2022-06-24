import { regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency } from '../types';

const re = /!reference \[(.*?)\]/g;

/**
 * Replaces GitLab reference tags before parsing, because our yaml parser cannot process them anyway.
 * @param content pipeline yaml
 * @returns replaced pipeline content
 * https://docs.gitlab.com/ee/ci/yaml/#reference-tags
 */
export function replaceReferenceTags(content: string): string {
  const res = content.replace(re, '');
  return res;
}

const depProxyRe = regEx(
  `(?<prefix>\\$\\{?CI_DEPENDENCY_PROXY_(?:DIRECT_)?GROUP_IMAGE_PREFIX\\}?\\/)(?<depName>.+)`
);
const ciRegistryRe = regEx(
  `(?<prefix>\\$\\{?CI_REGISTRY\\}?\\/)(?<depName>.+)`
);

/**
 * Get image dependencies respecting Gitlab Dependency Proxy
 * @param imageName as used in .gitlab-ci.yml file
 * @return package dependency for the image
 */
export function getGitlabDep(
  imageName: string,
  registryPrefix?: string
): PackageDependency {
  const match = depProxyRe.exec(imageName);
  if (match?.groups) {
    const dep = { ...getDep(match.groups.depName), replaceString: imageName };
    // TODO: #7154
    dep.autoReplaceStringTemplate = `${match.groups.prefix}${dep.autoReplaceStringTemplate}`;
    return dep;
  }
  const ciRegistryMatch = ciRegistryRe.exec(imageName);
  if (ciRegistryMatch?.groups && registryPrefix) {
    const dep = {
      ...getDep(`${registryPrefix}/${ciRegistryMatch.groups.depName}`),
      replaceString: imageName,
    };
    // TODO: #7154
    dep.autoReplaceStringTemplate = `${ciRegistryMatch.groups.prefix}${dep.autoReplaceStringTemplate}`;
    return dep;
  }

  return getDep(imageName);
}
