import { regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency } from '../types';

const depProxyRe = regEx(
  `(?<prefix>\\$\\{?CI_DEPENDENCY_PROXY_(?:DIRECT_)?GROUP_IMAGE_PREFIX\\}?/)(?<depName>.+)`,
);

/**
 * Get image dependencies respecting Gitlab Dependency Proxy
 * @param imageName as used in .gitlab-ci.yml file
 * @return package dependency for the image
 */
export function getGitlabDep(
  imageName: string,
  registryAliases?: Record<string, string>,
): PackageDependency {
  const match = depProxyRe.exec(imageName);
  if (match?.groups) {
    const dep = { ...getDep(match.groups.depName), replaceString: imageName };
    // TODO: types (#22198)
    dep.autoReplaceStringTemplate = `${match.groups.prefix}${dep.autoReplaceStringTemplate}`;
    return dep;
  }

  const dep = getDep(imageName, true, registryAliases);

  // Resolve registry aliases to their real value in depName
  for (const [name, value] of Object.entries(registryAliases ?? {})) {
    if (dep.depName?.startsWith(`${name}/`)) {
      if (dep.depName?.startsWith(name)) {
        dep.depName = `${value}/${dep.depName.substring(name.length + 1)}`;
      }
    }
  }
  return dep;
}
