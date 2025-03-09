import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseYaml } from '../../../util/yaml';
import type { PackageDependency, PackageFileContent } from '../types';
import { GitlabDocumentArray } from './schema';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  const platform = GlobalConfig.get('platform');
  const endpoint = GlobalConfig.get('endpoint');
  const registryUrls =
    platform === 'gitlab' && endpoint
      ? [endpoint.replace(regEx(/\/api\/v4\/?/), '')]
      : null;

  try {
    const docs = parseYaml(content, { uniqueKeys: false });
    for (const dep of GitlabDocumentArray.parse(docs)) {
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }
      deps.push(dep);
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug(
        { err, packageFile },
        'YAML exception extracting GitLab CI includes',
      );
    } else {
      logger.debug({ err, packageFile }, 'Error extracting GitLab CI includes');
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
