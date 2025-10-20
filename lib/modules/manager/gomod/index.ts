import type { Category } from '../../../constants';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import type { ExtractConfig, PackageFile } from '../types';
import { GoDatasource } from '../../datasource/go';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency, updateArtifacts };

export const displayName = 'Go Modules';
export const url = 'https://go.dev/ref/mod';
export const categories: Category[] = ['golang'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)go\\.mod$/'],
  pinDigests: false,
};

export const supportedDatasources = [
  GoDatasource.id,
  GolangVersionDatasource.id,
];

/**
 * Extract all package files for gomod
 */
export async function extractAllPackageFiles(
  config: ExtractConfig,
  fileList: string[],
): Promise<PackageFile[] | null> {
  logger.debug(`gomod.extractAllPackageFiles(${fileList.length} files)`);

  const packageFiles: PackageFile[] = [];

  for (const packageFile of fileList) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      const res = extractPackageFile(content);
      if (res) {
        packageFiles.push({
          ...res,
          packageFile,
        });
      }
    } else {
      logger.debug(`${packageFile} has no content`);
    }
  }

  return packageFiles.length ? packageFiles : null;
}
