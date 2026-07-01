import { logger } from '../../../logger/index.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';
import {
  massage as massageToml,
  parse as parseToml,
} from '../../../util/toml.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { PythonVersionDatasource } from '../../datasource/python-version/index.ts';
import * as pep440 from '../../versioning/pep440/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { processors } from './processors/index.ts';
import { PyProject } from './schema.ts';
import { depTypes } from './utils.ts';

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

function getUvRequiredVersionReplacement(
  content: string,
  uvRequiredVersion: string,
): Pick<PackageDependency, 'autoReplaceStringTemplate' | 'replaceString'> {
  let isToolUvSection = false;

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*\[tool\.uv]\s*(?:#.*)?$/.test(line)) {
      isToolUvSection = true;
      continue;
    }

    if (/^\s*\[/.test(line)) {
      isToolUvSection = false;
      continue;
    }

    if (!isToolUvSection) {
      continue;
    }

    const match =
      /^(?<prefix>\s*required-version\s*=\s*)(?:"(?<doubleValue>[^"]+)"|'(?<singleValue>[^']+)')/.exec(
        line,
      );

    if (match?.groups) {
      const quote = match.groups.doubleValue ? '"' : "'";
      const currentValue = match.groups.doubleValue ?? match.groups.singleValue;
      return {
        replaceString: `${match.groups.prefix}${quote}${currentValue}${quote}`,
        autoReplaceStringTemplate: `${match.groups.prefix}${quote}{{newValue}}${quote}`,
      };
    }
  }

  return {};
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
  const extractedConstraints: Partial<Record<ConstraintName, string>> = {};
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

  const uvRequiredVersion = def.tool?.uv?.['required-version'];
  if (uvRequiredVersion) {
    const replacement = getUvRequiredVersionReplacement(
      content,
      uvRequiredVersion,
    );
    deps.push({
      depName: 'uv',
      packageName: 'astral-sh/uv',
      datasource: GithubReleasesDatasource.id,
      versioning: pep440.id,
      depType: depTypes.uvRequiredVersion,
      currentValue: uvRequiredVersion,
      ...replacement,
    });
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
