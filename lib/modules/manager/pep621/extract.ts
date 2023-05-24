import toml from '@iarna/toml';
import { logger } from '../../../logger';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { processors } from './processors';
import { PyProject, PyProjectSchema } from './schema';
import { parseDependencyGroupRecord, parseDependencyList } from './utils';

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig
): PackageFileContent | null {
  logger.trace(`pep621.extractPackageFile(${packageFile})`);

  const deps: PackageDependency[] = [];

  let def: PyProject;
  try {
    const jsonMap = toml.parse(content);
    def = PyProjectSchema.parse(jsonMap);
  } catch (err) {
    logger.debug(
      {  packageFile, err },
      `Failed to parse and validate pyproject file`
    );
    return null;
  }

  // pyProject standard definitions
  deps.push(
    ...parseDependencyList('project.dependencies', def.project?.dependencies)
  );
  deps.push(
    ...parseDependencyGroupRecord(
      'project.optional-dependencies',
      def.project?.['optional-dependencies']
    )
  );

  // process specific tool sets
  let processedDeps = deps;
  for (const processor of processors) {
    processedDeps = processor.process(def, processedDeps);
  }

  return processedDeps.length ? { deps: processedDeps } : null;
}
