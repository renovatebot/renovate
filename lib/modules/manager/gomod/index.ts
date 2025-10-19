import type { Category } from '../../../constants';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { GoDatasource } from '../../datasource/go';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import type { PackageFile } from '../types';
import type { WorkerExtractConfig } from '../../../workers/types';
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
 * Extract all package files and build dependency graph for gomodTidyAll
 */
export async function extractAllPackageFiles(
  config: WorkerExtractConfig,
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

  const isGomodTidyAllEnabled =
    config.postUpdateOptions?.includes('gomodTidyAll');
  if (isGomodTidyAllEnabled && packageFiles.length > 0) {
    try {
      const { buildGoModDependencyGraph } = await import('./package-tree.js');
      const graph = await buildGoModDependencyGraph(fileList);

      (globalThis as any).gomodDependencyGraph = graph;

      logger.debug(
        `Built Go module dependency graph with ${graph.nodes.size} modules`,
      );
    } catch (error) {
      logger.warn({ error }, 'Failed to build Go module dependency graph');
    }
  }

  return packageFiles.length ? packageFiles : null;
}
