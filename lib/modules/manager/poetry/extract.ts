import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { filterMap } from '../../../util/filter-map';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { Result } from '../../../util/result';
import type { PackageDependency, PackageFileContent } from '../types';
import {
  Lockfile,
  type PoetryDependencyRecord,
  type PoetryGroupRecord,
  type PoetrySchema,
  PoetrySchemaToml,
  type PoetrySectionSchema,
} from './schema';

function extractFromDependenciesSection(
  parsedFile: PoetrySchema,
  section: keyof Omit<PoetrySectionSchema, 'source' | 'group'>,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  return extractFromSection(
    parsedFile?.tool?.poetry?.[section],
    section,
    poetryLockfile
  );
}

function extractFromDependenciesGroupSection(
  groupSections: PoetryGroupRecord | undefined,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  if (!groupSections) {
    return [];
  }

  const deps = [];
  for (const groupName of Object.keys(groupSections)) {
    deps.push(
      ...extractFromSection(
        groupSections[groupName]?.dependencies,
        groupName,
        poetryLockfile
      )
    );
  }

  return deps;
}

function extractFromSection(
  sectionContent: PoetryDependencyRecord | undefined,
  depType: string,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  if (!sectionContent) {
    return [];
  }

  return filterMap(Object.values(sectionContent), (dep) => {
    if (dep.depName === 'python' || dep.depName === 'source') {
      return null;
    }

    dep.depType = depType;

    const packageName = dep.packageName ?? dep.depName;
    if (packageName && packageName in poetryLockfile) {
      dep.lockedVersion = poetryLockfile[packageName];
    }

    return dep;
  });
}

function extractRegistries(pyprojectfile: PoetrySchema): string[] | undefined {
  const sources = pyprojectfile?.tool?.poetry?.source;

  if (!Array.isArray(sources) || sources.length === 0) {
    return undefined;
  }

  const registryUrls = new Set<string>();
  for (const source of sources) {
    if (source.url) {
      registryUrls.add(source.url);
    }
  }
  registryUrls.add(process.env.PIP_INDEX_URL ?? 'https://pypi.org/pypi/');

  return Array.from(registryUrls);
}

export async function extractPackageFile(
  content: string,
  packageFile: string
): Promise<PackageFileContent | null> {
  logger.trace(`poetry.extractPackageFile(${packageFile})`);
  const { val: pyprojectfile, err } = Result.parse(
    PoetrySchemaToml,
    content
  ).unwrap();
  if (err) {
    logger.debug({ packageFile, err }, `Poetry: error parsing pyproject.toml`);
    return null;
  }

  // handle the lockfile
  const lockfileName = getSiblingFileName(packageFile, 'poetry.lock');
  // TODO #22198
  const lockContents = (await readLocalFile(lockfileName, 'utf8'))!;

  const lockfileMapping = Result.parse(
    Lockfile.transform(({ lock }) => lock),
    lockContents
  ).unwrapOrElse({});

  const deps = [
    ...extractFromDependenciesSection(
      pyprojectfile,
      'dependencies',
      lockfileMapping
    ),
    ...extractFromDependenciesSection(
      pyprojectfile,
      'dev-dependencies',
      lockfileMapping
    ),
    ...extractFromDependenciesSection(pyprojectfile, 'extras', lockfileMapping),
    ...extractFromDependenciesGroupSection(
      pyprojectfile?.tool?.poetry?.group,
      lockfileMapping
    ),
  ];

  if (!deps.length) {
    return null;
  }

  const extractedConstraints: Record<string, any> = {};

  const pythonVersion =
    pyprojectfile?.tool?.poetry?.dependencies?.python?.currentValue;
  if (is.nonEmptyString(pythonVersion)) {
    extractedConstraints.python = pythonVersion;
  }

  const res: PackageFileContent = {
    deps,
    registryUrls: extractRegistries(pyprojectfile),
    extractedConstraints,
  };
  // Try poetry.lock first
  let lockFile = getSiblingFileName(packageFile, 'poetry.lock');
  // istanbul ignore next
  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  } else {
    // Try pyproject.lock next
    lockFile = getSiblingFileName(packageFile, 'pyproject.lock');
    if (await localPathExists(lockFile)) {
      res.lockFiles = [lockFile];
    }
  }
  return res;
}
