import { logger } from '../../../logger';
import { massage as massageToml, parse as parseToml } from '../../../util/toml';
import { PythonVersionDatasource } from '../../datasource/python-version';
import * as pep440 from '../../versioning/pep440';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { processors } from './processors';
import { PyProject } from './schema';

export function parsePyProject(
  content: string,
  packageFile?: string,
): PyProject | null {
  try {
    const jsonMap = parseToml(massageToml(content));
    return PyProject.parse(jsonMap);
  } catch (err) {
    logger.debug(
      { packageFile, err },
      `Failed to parse and validate pyproject file`,
    );
    return null;
  }
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`pep621.extractPackageFile(${packageFile})`);

  const def = parsePyProject(content, packageFile);
  if (!def) {
    return null;
  }

  const deps: PackageDependency[] = [];

  const pythonConstraint = def.project?.['requires-python'];
  const extractedConstraints: Record<string, string> = {};
  if (pythonConstraint) {
    extractedConstraints.python = pythonConstraint;
    deps.push({
      packageName: 'python',
      depType: 'requires-python',
      currentValue: pythonConstraint,
      commitMessageTopic: 'Python',
      datasource: PythonVersionDatasource.id,
      versioning: pep440.id,
    });
  }

  const projectDependencies = def.project?.dependencies;
  if (projectDependencies) {
    deps.push(...projectDependencies);
  }

  const dependencyGroups = def['dependency-groups'];
  if (dependencyGroups) {
    deps.push(...dependencyGroups);
  }

  const projectOptionalDependencies = def.project?.['optional-dependencies'];
  if (projectOptionalDependencies) {
    deps.push(...projectOptionalDependencies);
  }

  const buildSystemRequires = def['build-system']?.requires;
  if (buildSystemRequires) {
    deps.push(...buildSystemRequires);
  }

  // process specific tool sets
  let processedDeps = deps;
  const lockFiles: string[] = [];
  for (const processor of processors) {
    processedDeps = processor.process(def, processedDeps);
    processedDeps = await processor.extractLockedVersions(
      def,
      processedDeps,
      packageFile,
    );

    const processedLockFiles = await processor.getLockfiles(def, packageFile);
    lockFiles.push(...processedLockFiles);
  }

  const packageFileVersion = def.project?.version;
  return processedDeps.length || lockFiles.length
    ? {
        extractedConstraints,
        deps: processedDeps,
        packageFileVersion,
        lockFiles,
      }
    : null;
}
