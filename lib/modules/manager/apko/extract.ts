import { isNonEmptyArray } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { isHttpUrl } from '../../../util/url.ts';
import { ApkDatasource } from '../../datasource/apk/index.ts';
import { api as apkVersioning } from '../../versioning/apk/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { ApkoConfig, ApkoLock, type ApkoLockPackage } from './schema.ts';

type SpecSkipReason =
  | 'unspecified-version'
  | 'contains-variable'
  | 'unsupported-version'
  | 'local-dependency';

interface DroppedSpec {
  kind: 'drop';
}

interface SkippedSpec {
  kind: 'skip';
  depName: string;
  skipReason: SpecSkipReason;
}

interface VersionedSpec {
  kind: 'versioned';
  depName: string;
  currentValue: string;
  replaceString: string;
  autoReplaceStringTemplate: string;
  tag: string | null;
}

type PackageSpec = DroppedSpec | SkippedSpec | VersionedSpec;

interface RepositoryIndex {
  untaggedHttp: string[];
  httpByTag: Map<string, string[]>;
  fileTags: Set<string>;
}

const packageSpecRegex = regEx(
  /^(?<name>[a-zA-Z0-9][\w.+-]*)(?:@(?<prefixTag>[\w.-]+))?(?:(?<operator>[<>=~]+)(?<version>[^@]+))?(?:@(?<suffixTag>[\w.-]+))?$/,
);

const taggedRepositoryRegex = regEx(/^@(?<tag>[\w.-]+)\s+(?<url>\S+)$/);

const yamlExtensionRegex = regEx(/\.ya?ml$/);

const allArchs = [
  '386',
  'amd64',
  'arm64',
  'arm/v6',
  'arm/v7',
  'loong64',
  'ppc64le',
  'riscv64',
  's390x',
];

const apkArchByApkoArch = new Map([
  ['386', 'x86'],
  ['amd64', 'x86_64'],
  ['arm64', 'aarch64'],
  ['arm/v6', 'armhf'],
  ['arm/v7', 'armv7'],
  ['loong64', 'loongarch64'],
]);

export function getLockFileName(packageFileName: string): string {
  const baseName = upath
    .basename(packageFileName)
    .replace(yamlExtensionRegex, '');
  return getSiblingFileName(packageFileName, `${baseName}.lock.json`);
}

function parsePackageSpec(
  spec: string,
  fileTags: ReadonlySet<string>,
): PackageSpec {
  const groups = packageSpecRegex.exec(spec)?.groups;
  if (!groups) {
    return { kind: 'drop' };
  }

  const { name: depName, operator, version } = groups;
  const tag = groups.prefixTag ?? groups.suffixTag ?? null;
  if (tag && fileTags.has(tag)) {
    return { kind: 'skip', depName, skipReason: 'local-dependency' };
  }
  if (!operator) {
    return { kind: 'skip', depName, skipReason: 'unspecified-version' };
  }
  if (version.includes('$')) {
    return { kind: 'skip', depName, skipReason: 'contains-variable' };
  }

  const constraint = `${operator}${version}`;
  if (!apkVersioning.isValid(constraint)) {
    return { kind: 'skip', depName, skipReason: 'unsupported-version' };
  }

  const currentValue = apkVersioning.isSingleVersion(constraint)
    ? version
    : constraint;
  const valueEnd = spec.indexOf(constraint) + constraint.length;
  const valuePrefix = spec.slice(0, valueEnd - currentValue.length);
  const tagSuffix = spec.slice(valueEnd);
  return {
    kind: 'versioned',
    depName,
    currentValue,
    replaceString: spec,
    autoReplaceStringTemplate: `${valuePrefix}{{{newValue}}}${tagSuffix}`,
    tag,
  };
}

function indexRepositories(entries: string[]): RepositoryIndex {
  const index: RepositoryIndex = {
    untaggedHttp: [],
    httpByTag: new Map(),
    fileTags: new Set(),
  };
  for (const entry of entries) {
    const tagged = taggedRepositoryRegex.exec(entry)?.groups;
    const tag = tagged?.tag ?? null;
    const url = tagged?.url ?? entry;
    if (url.includes('?')) {
      continue;
    }
    if (!isHttpUrl(url)) {
      if (tag) {
        index.fileTags.add(tag);
      }
      continue;
    }

    if (tag) {
      index.httpByTag.set(tag, [...coerceArray(index.httpByTag.get(tag)), url]);
      continue;
    }
    index.untaggedHttp.push(url);
  }
  return index;
}

function requestedArchs(archs: string[] | undefined): string[] {
  if (!archs?.length) {
    return allArchs;
  }
  if (archs.length === 1 && archs[0] === 'all') {
    return allArchs;
  }
  return archs;
}

function registryUrlsFor(
  tag: string | null,
  repositories: RepositoryIndex,
  apkArchs: string[],
): string[] {
  const tagged = tag === null ? undefined : repositories.httpByTag.get(tag);
  const urls = tagged
    ? [...tagged, ...repositories.untaggedHttp]
    : repositories.untaggedHttp;
  return urls.flatMap((url) => apkArchs.map((arch) => `${url}?arch=${arch}`));
}

function lockedVersionOf(
  depName: string,
  lockPackages: ApkoLockPackage[],
): string | undefined {
  const versions = new Set(
    lockPackages
      .filter((lockPackage) => lockPackage.name === depName)
      .map((lockPackage) => lockPackage.version),
  );
  if (versions.size !== 1) {
    return undefined;
  }
  const [version] = versions;
  return version;
}

function toDependency(
  spec: SkippedSpec | VersionedSpec,
  repositories: RepositoryIndex,
  apkArchs: string[],
  lockPackages: ApkoLockPackage[],
): PackageDependency {
  if (spec.kind === 'skip') {
    return {
      datasource: ApkDatasource.id,
      depName: spec.depName,
      skipReason: spec.skipReason,
    };
  }

  const dep: PackageDependency = {
    datasource: ApkDatasource.id,
    depName: spec.depName,
    currentValue: spec.currentValue,
    replaceString: spec.replaceString,
    autoReplaceStringTemplate: spec.autoReplaceStringTemplate,
  };
  const registryUrls = registryUrlsFor(spec.tag, repositories, apkArchs);
  if (isNonEmptyArray(registryUrls)) {
    dep.registryUrls = registryUrls;
  } else {
    dep.skipReason = 'unknown-registry';
  }
  const lockedVersion = lockedVersionOf(spec.depName, lockPackages);
  if (lockedVersion) {
    dep.lockedVersion = lockedVersion;
  }
  return dep;
}

async function readLockPackages(
  lockFileName: string,
  packageFile: string,
): Promise<ApkoLockPackage[] | null> {
  const content = await readLocalFile(lockFileName, 'utf8');
  if (!content) {
    return null;
  }

  const lock = ApkoLock.safeParse(content);
  if (!lock.success) {
    logger.debug(
      { err: lock.error, packageFile },
      'Failed to parse apko lock file',
    );
    return null;
  }
  return lock.data.contents.packages;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  const parsed = ApkoConfig.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { err: parsed.error, packageFile },
      'Failed to parse apko file',
    );
    return null;
  }

  const { contents, archs } = parsed.data;
  const repositoryEntries = [
    ...coerceArray(contents.repositories),
    ...coerceArray(contents.build_repositories),
  ];
  const repositories = indexRepositories(repositoryEntries);
  const specs = contents.packages
    .map((spec) => parsePackageSpec(spec, repositories.fileTags))
    .filter((spec) => spec.kind !== 'drop');
  if (!specs.length) {
    logger.debug(`No apk packages found in ${packageFile}`);
    return null;
  }

  const apkArchs = requestedArchs(archs).map(
    (arch) => apkArchByApkoArch.get(arch) ?? arch,
  );
  const lockFileName = getLockFileName(packageFile);
  const lockPackages = await readLockPackages(lockFileName, packageFile);
  const deps = specs.map((spec) =>
    toDependency(spec, repositories, apkArchs, coerceArray(lockPackages)),
  );
  if (!lockPackages) {
    return { deps };
  }
  return { deps, lockFiles: [lockFileName] };
}
