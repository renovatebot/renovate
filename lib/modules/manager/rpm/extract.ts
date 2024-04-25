import { logger } from '../../../logger';
// import { parseYaml } from '../../../util/yaml';
import type { PackageFileContent } from '../types';
// import type { RpmLockfile } from './types';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.debug(`rpm.extractPackageFile(${packageFile})`);

  // let yaml = parseYaml<RpmLockfile>(content, null, {
  //   json: true,
  // });

  // TODO: Handle yml/yaml here
  return {
    lockFiles: ['rpms.lock.yaml'],
    deps: [],
  };
}
