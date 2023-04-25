import toml from '@iarna/toml';
import { logger } from '../../../logger';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { processPDM } from './pdm';
import { PyProject, PyProjectSchema } from './schema';
import { parseDependencyGroupRecord, parseDependencyList } from './utils';

export function extractPackageFile(
  content: string,
  fileName: string,
  config?: ExtractConfig
): PackageFileContent | null {
  logger.trace({ fileName }, 'pep621.extractPackageFile');

  const deps: PackageDependency[] = [];

  let def: PyProject;
  try {
    const jsonMap = toml.parse(content);
    def = PyProjectSchema.parse(jsonMap);
  } catch (err) {
    logger.warn(
      { fileName, err },
      `Failed to parse and validate pyproject file`
    );
    return null;
  }

  deps.push(
    ...parseDependencyList('project.dependencies', def.project?.dependencies)
  );
  deps.push(
    ...parseDependencyGroupRecord(
      'project.optional-dependencies',
      def.project?.['optional-dependencies']
    )
  );

  const processedDeps = processPDM(def, deps);

  return processedDeps.length ? { deps: processedDeps } : null;
}
