import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { processors } from './processors';
import {
  depTypes,
  parseDependencyGroupRecord,
  parseDependencyList,
  parsePyProject,
} from './utils';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`pep621.extractPackageFile(${packageFile})`);

  const deps: PackageDependency[] = [];

  const def = parsePyProject(packageFile, content);
  if (is.nullOrUndefined(def)) {
    return null;
  }

  const packageFileVersion = def.project?.version;
  const pythonConstraint = def.project?.['requires-python'];
  const extractedConstraints = is.nonEmptyString(pythonConstraint)
    ? { extractedConstraints: { python: pythonConstraint } }
    : {};

  // pyProject standard definitions
  deps.push(
    ...parseDependencyList(depTypes.dependencies, def.project?.dependencies),
  );
  deps.push(
    ...parseDependencyGroupRecord(
      depTypes.optionalDependencies,
      def.project?.['optional-dependencies'],
    ),
  );
  deps.push(
    ...parseDependencyList(
      depTypes.buildSystemRequires,
      def['build-system']?.requires,
    ),
  );

  // process specific tool sets
  let processedDeps = deps;
  for (const processor of processors) {
    processedDeps = processor.process(def, processedDeps);
    processedDeps = await processor.extractLockedVersions(
      def,
      processedDeps,
      packageFile,
    );
  }

  return processedDeps.length
    ? { ...extractedConstraints, deps: processedDeps, packageFileVersion }
    : null;
}
