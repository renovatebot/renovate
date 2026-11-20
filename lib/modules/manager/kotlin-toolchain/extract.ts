import { isBoolean, isNumber, isPlainObject, isString } from '@sindresorhus/is';
import upath from 'upath';
import type { ZodType } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { MAVEN_REPO } from '../../datasource/maven/common.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { builtInVersions } from './built-ins.ts';
import { extractCatalog } from './catalog.ts';
import { parseCoordinate } from './coordinate.ts';
import {
  KotlinToolchainCompilerPlugins,
  KotlinToolchainDependencies,
  KotlinToolchainFile,
  KotlinToolchainMavenPlugins,
  KotlinToolchainRepositories,
} from './schema.ts';
import type { KotlinToolchainManagerData } from './types.ts';

const dependenciesSectionRegex = regEx(/^(?:test-)?dependencies(?:@.+)?$/);
const settingsSectionRegex = regEx(/^(?:test-)?settings(?:@.+)?$/);

const processorPaths = [
  ['java', 'annotationProcessing', 'processors'],
  ['kotlin', 'ksp', 'processors'],
];
const compilerPluginsPath = ['kotlin', 'compilerPlugins'];

const moduleMarkers = new Set(['product', 'apply', 'mavenPlugins']);

const googleMavenRepo = 'https://maven.google.com';
const defaultRepositories = [MAVEN_REPO, googleMavenRepo];
const ignoredRepository = 'mavenLocal';
const repositoryAliases = new Map([
  ['mavenCentral', MAVEN_REPO],
  ['mavenGoogle', googleMavenRepo],
  ['google', googleMavenRepo],
]);

function isKotlinToolchainFile(keys: string[], packageFile: string): boolean {
  if (upath.basename(packageFile) === 'project.yaml') {
    return keys.includes('modules') || keys.includes('mavenPlugins');
  }
  return keys.some(
    (key) =>
      moduleMarkers.has(key) ||
      dependenciesSectionRegex.test(key) ||
      settingsSectionRegex.test(key),
  );
}

function coordinateDeps(
  coordinates: string[],
  depType: string,
): PackageDependency<KotlinToolchainManagerData>[] {
  const deps: PackageDependency<KotlinToolchainManagerData>[] = [];
  for (const coordinate of coordinates) {
    const dep = parseCoordinate(coordinate);
    if (dep) {
      dep.depType = depType;
      dep.datasource = MavenDatasource.id;
      dep.replaceString = coordinate;
      if (dep.currentValue) {
        dep.replaceString = `${dep.depName}:${dep.currentValue}`;
        dep.autoReplaceStringTemplate = '{{{depName}}}:{{{newValue}}}';
      }
      deps.push(dep);
    }
  }
  return deps;
}

function coordinatesFrom(
  schema: ZodType<string[]>,
  value: unknown,
  depType: string,
): PackageDependency<KotlinToolchainManagerData>[] {
  const coordinates = schema.safeParse(value);
  return coordinates.success ? coordinateDeps(coordinates.data, depType) : [];
}

function digSetting(settings: unknown, path: string[]): unknown {
  let value = settings;
  for (const segment of path) {
    if (!isPlainObject(value)) {
      return null;
    }
    value = value[segment];
  }
  return value;
}

function builtInVersionDeps(
  sectionKey: string,
  settings: unknown,
): PackageDependency<KotlinToolchainManagerData>[] {
  const deps: PackageDependency<KotlinToolchainManagerData>[] = [];
  for (const builtIn of builtInVersions) {
    const value = digSetting(settings, builtIn.path);
    const settingPath = [sectionKey, ...builtIn.path].join('.');
    if (isString(value)) {
      deps.push({
        depName: builtIn.depName,
        currentValue: value,
        depType: 'settings',
        datasource: MavenDatasource.id,
        managerData: { settingPath },
        registryUrls: builtIn.registryUrls,
      });
    } else if (isNumber(value) || isBoolean(value)) {
      const currentValue = String(value);
      logger.debug(
        `Kotlin Toolchain version at ${settingPath} is not a string: ${currentValue}`,
      );
      deps.push({
        depName: builtIn.depName,
        currentValue,
        skipReason: 'invalid-value',
        depType: 'settings',
        datasource: MavenDatasource.id,
        managerData: { settingPath },
      });
    }
  }
  return deps;
}

function extractSettingsSection(
  sectionKey: string,
  section: unknown,
): PackageDependency<KotlinToolchainManagerData>[] {
  if (!isPlainObject(section)) {
    return [];
  }

  const deps = builtInVersionDeps(sectionKey, section);

  for (const path of processorPaths) {
    deps.push(
      ...coordinatesFrom(
        KotlinToolchainDependencies,
        digSetting(section, path),
        'settings',
      ),
    );
  }

  deps.push(
    ...coordinatesFrom(
      KotlinToolchainCompilerPlugins,
      digSetting(section, compilerPluginsPath),
      'settings',
    ),
  );

  return deps;
}

export function extractRegistryUrls(file: KotlinToolchainFile): string[] {
  const urls = [...defaultRepositories];
  const repositories = KotlinToolchainRepositories.safeParse(file.repositories);
  if (repositories.success) {
    for (const entry of repositories.data) {
      if (entry !== null && entry !== ignoredRepository) {
        urls.push(repositoryAliases.get(entry) ?? entry);
      }
    }
  }
  return [...new Set(urls)];
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent<KotlinToolchainManagerData> | null {
  if (upath.basename(packageFile) === 'libs.versions.toml') {
    const res = extractCatalog(content, packageFile);
    if (res) {
      for (const dep of res.deps) {
        dep.registryUrls = [...defaultRepositories];
      }
    }
    return res;
  }
  const file = KotlinToolchainFile.safeParse(content);
  if (!file.success) {
    logger.debug(
      { err: file.error, packageFile },
      'Failed to parse Kotlin Toolchain file',
    );
    return null;
  }

  return extractYamlFile(
    file.data,
    packageFile,
    extractRegistryUrls(file.data),
  );
}

export function extractYamlFile(
  file: KotlinToolchainFile,
  packageFile: string,
  registryUrls: string[],
): PackageFileContent<KotlinToolchainManagerData> | null {
  const keys = Object.keys(file);
  if (!isKotlinToolchainFile(keys, packageFile)) {
    logger.debug(`Not a Kotlin Toolchain file: ${packageFile}`);
    return null;
  }

  const deps: PackageDependency<KotlinToolchainManagerData>[] = [];
  for (const [key, value] of Object.entries(file)) {
    if (dependenciesSectionRegex.test(key)) {
      deps.push(...coordinatesFrom(KotlinToolchainDependencies, value, key));
    } else if (settingsSectionRegex.test(key)) {
      deps.push(...extractSettingsSection(key, value));
    } else if (key === 'mavenPlugins') {
      deps.push(
        ...coordinatesFrom(KotlinToolchainMavenPlugins, value, 'mavenPlugins'),
      );
    }
  }

  for (const dep of deps) {
    dep.registryUrls = [
      ...new Set([...registryUrls, ...coerceArray(dep.registryUrls)]),
    ];
  }

  return { deps };
}
