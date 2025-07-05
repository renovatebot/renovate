import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { readLocalFile, writeLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { ExecOptions } from '../../../util/exec/types';
import upath from 'upath';
import type { UpdateArtifactsResult } from '../types';
import { buildDependencyGraph, findDependentModules } from './dependency-graph';

/**
 * Updates dependent modules when a Go module is updated
 */
export async function updateDependentModules(
  updatedModulePath: string,
  goModFiles: string[],
  config: any,
): Promise<UpdateArtifactsResult[]> {
  const results: UpdateArtifactsResult[] = [];

  try {
    // Build dependency graph
    const graph = await buildDependencyGraph(upath.dirname(updatedModulePath), goModFiles);

    // Find the module name of the updated module
    const updatedModuleContent = await readLocalFile(updatedModulePath, 'utf8');
    if (!updatedModuleContent) {
      logger.debug('Could not read updated module content');
      return results;
    }

    const moduleMatch = updatedModuleContent.match(/^module\s+([^\s]+)/m);
    const updatedModuleName = moduleMatch?.[1];

    if (!updatedModuleName) {
      logger.debug('Could not extract module name from updated module');
      return results;
    }

    // Find all modules that depend on this module
    const dependentModules = findDependentModules(graph, updatedModuleName);

    if (dependentModules.length === 0) {
      logger.debug('No dependent modules found');
      return results;
    }

    logger.debug(
      { updatedModuleName, dependentModules },
      'Found dependent modules that need updating',
    );

    // Update each dependent module
    for (const dependentModuleName of dependentModules) {
      const dependentModule = graph.modules.get(dependentModuleName);
      if (!dependentModule) {
        continue;
      }

      const dependentGoModPath = upath.join(dependentModule.modulePath, 'go.mod');
      const dependentGoSumPath = upath.join(dependentModule.modulePath, 'go.sum');

      logger.debug(
        { dependentModuleName, dependentGoModPath },
        'Updating dependent module',
      );

      // Run go mod tidy on the dependent module
      const execOptions: ExecOptions = {
        cwdFile: dependentGoModPath,
        extraEnv: {
          GOPATH: await ensureCacheDir('go'),
          GOPROXY: process.env.GOPROXY,
          GOPRIVATE: process.env.GOPRIVATE,
          GONOPROXY: process.env.GONOPROXY,
          GONOSUMDB: process.env.GONOSUMDB,
          GOSUMDB: process.env.GOSUMDB,
          GOINSECURE: process.env.GOINSECURE,
          CGO_ENABLED: process.env.CGO_ENABLED || '0',
        },
        docker: {},
        toolConstraints: [
          {
            toolName: 'golang',
            constraint: config.constraints?.go || '^1.14',
          },
        ],
      };

      try {
        // Run go mod tidy
        await exec(['go mod tidy'], execOptions);

        // Check if files were modified
        const status = await getRepoStatus();

        // Check if go.mod was modified
        if (status.modified.includes(dependentGoModPath)) {
          const updatedGoModContent = await readLocalFile(dependentGoModPath, 'utf8');
          if (updatedGoModContent) {
            results.push({
              file: {
                type: 'addition',
                path: dependentGoModPath,
                contents: updatedGoModContent,
              },
            });
            logger.debug('Updated dependent go.mod file');
          }
        }

        // Check if go.sum was modified
        if (status.modified.includes(dependentGoSumPath)) {
          const updatedGoSumContent = await readLocalFile(dependentGoSumPath, 'utf8');
          if (updatedGoSumContent) {
            results.push({
              file: {
                type: 'addition',
                path: dependentGoSumPath,
                contents: updatedGoSumContent,
              },
            });
            logger.debug('Updated dependent go.sum file');
          }
        }

      } catch (error) {
        logger.warn(
          { dependentModuleName, error },
          'Failed to update dependent module',
        );
      }
    }

  } catch (error) {
    logger.warn(
      { updatedModulePath, error },
      'Failed to update dependent modules',
    );
  }

  return results;
}

/**
 * Ensures the cache directory exists
 */
async function ensureCacheDir(toolName: string): Promise<string> {
  // This is a simplified version - in practice, you'd want to use the actual cache directory logic
  return process.env.GOPATH || upath.join(process.cwd(), '.cache', toolName);
}
