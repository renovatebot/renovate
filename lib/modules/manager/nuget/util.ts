import upath from 'upath';
import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import {
  findLocalSiblingOrParent,
  findUpLocal,
  readLocalFile,
} from '../../../util/fs';
import { minimatch } from '../../../util/minimatch';
import { regEx } from '../../../util/regex';
import { nugetOrg } from '../../datasource/nuget';
import { GlobalJson } from './schema';
import type { NugetPackageDependency, Registry } from './types';

export async function readFileAsXmlDocument(
  file: string,
): Promise<XmlDocument | undefined> {
  try {
    // TODO #22198
    const doc = new XmlDocument((await readLocalFile(file, 'utf8'))!);
    // don't return empty documents
    return doc?.firstChild ? doc : undefined;
  } catch (err) {
    logger.debug({ err, file }, `failed to parse file as XML document`);
    return undefined;
  }
}

/**
 * The default `nuget.org` named registry.
 * @returns the default registry for NuGet
 */
export function getDefaultRegistries(): Registry[] {
  return [{ url: nugetOrg, name: 'nuget.org' }];
}

export async function getConfiguredRegistries(
  packageFile: string,
): Promise<Registry[] | undefined> {
  // Valid file names taken from https://github.com/NuGet/NuGet.Client/blob/f64621487c0b454eda4b98af853bf4a528bef72a/src/NuGet.Core/NuGet.Configuration/Settings/Settings.cs#L34
  const nuGetConfigFileNames = ['nuget.config', 'NuGet.config', 'NuGet.Config'];
  // normalize paths, otherwise startsWith can fail because of path delimitter mismatch
  const nuGetConfigPath = await findUpLocal(
    nuGetConfigFileNames,
    upath.dirname(packageFile),
  );
  if (!nuGetConfigPath) {
    return undefined;
  }

  logger.debug(`Found NuGet.config at ${nuGetConfigPath}`);
  const nuGetConfig = await readFileAsXmlDocument(nuGetConfigPath);

  if (!nuGetConfig) {
    return undefined;
  }

  const packageSources = nuGetConfig.childNamed('packageSources');

  if (!packageSources) {
    // If there are no packageSources, don't even look for any
    // disabledPackageSources
    // Even if NuGet default source (nuget.org) was among the
    // disabledPackageSources, Renovate will default to the default source
    // (nuget.org) anyway
    return undefined;
  }

  const packageSourceMapping = nuGetConfig.childNamed('packageSourceMapping');

  let registries = getDefaultRegistries();

  // Map optional source mapped package patterns to default registries
  for (const registry of registries) {
    const sourceMappedPackagePatterns = packageSourceMapping
      ?.childWithAttribute('key', registry.name)
      ?.childrenNamed('package')
      .map((packagePattern) => packagePattern.attr['pattern']);

    registry.sourceMappedPackagePatterns = sourceMappedPackagePatterns;
  }

  for (const child of packageSources.children) {
    if (child.type === 'element') {
      if (child.name === 'clear') {
        logger.debug(`clearing registry URLs`);
        registries.length = 0;
      } else if (child.name === 'add') {
        const isHttpUrl = regEx(/^https?:\/\//i).test(child.attr.value);
        if (isHttpUrl) {
          let registryUrl = child.attr.value;
          if (child.attr.protocolVersion) {
            registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
          }
          const sourceMappedPackagePatterns = packageSourceMapping
            ?.childWithAttribute('key', child.attr.key)
            ?.childrenNamed('package')
            .map((packagePattern) => packagePattern.attr['pattern']);

          logger.debug(
            {
              name: child.attr.key,
              registryUrl,
              sourceMappedPackagePatterns,
            },
            `Adding registry URL ${registryUrl}`,
          );

          registries.push({
            name: child.attr.key,
            url: registryUrl,
            sourceMappedPackagePatterns,
          });
        } else {
          logger.debug(
            { registryUrl: child.attr.value },
            'ignoring local registry URL',
          );
        }
      }
      // child.name === 'remove' not supported
    }
  }

  const disabledPackageSources = nuGetConfig.childNamed(
    'disabledPackageSources',
  );

  if (disabledPackageSources) {
    for (const child of disabledPackageSources.children) {
      if (
        child.type === 'element' &&
        child.name === 'add' &&
        child.attr.value === 'true'
      ) {
        const disabledRegistryKey = child.attr.key;
        registries = registries.filter((o) => o.name !== disabledRegistryKey);
        logger.debug(`Disabled registry with key: ${disabledRegistryKey}`);
      }
    }
  }

  return registries;
}

export function findVersion(parsedXml: XmlDocument): XmlElement | null {
  for (const tag of ['Version', 'VersionPrefix']) {
    for (const l1Elem of parsedXml.childrenNamed('PropertyGroup')) {
      for (const l2Elem of l1Elem.childrenNamed(tag)) {
        return l2Elem;
      }
    }
  }
  return null;
}

export function applyRegistries(
  dep: NugetPackageDependency,
  registries: Registry[] | undefined,
): NugetPackageDependency {
  if (registries) {
    if (!registries.some((reg) => reg.sourceMappedPackagePatterns)) {
      dep.registryUrls = registries.map((reg) => reg.url);
      return dep;
    }

    const regs = registries.filter((r) => r.sourceMappedPackagePatterns);
    const map = new Map<string, Registry[]>(
      regs.flatMap((r) => r.sourceMappedPackagePatterns!.map((p) => [p, []])),
    );
    const depName = dep.depName;

    for (const reg of regs) {
      for (const pattern of reg.sourceMappedPackagePatterns!) {
        map.get(pattern)!.push(reg);
      }
    }

    const urls: string[] = [];

    for (const [pattern, regs] of [...map].sort(sortPatterns)) {
      if (minimatch(pattern, { nocase: true }).match(depName)) {
        urls.push(...regs.map((r) => r.url));
        break;
      }
    }

    if (urls.length) {
      dep.registryUrls = urls;
    }
  }
  return dep;
}

/*
 * Sorts patterns by specificity:
 * 1. Exact match patterns
 * 2. Wildcard match patterns
 */
function sortPatterns(
  a: [string, Registry[]],
  b: [string, Registry[]],
): number {
  if (a[0].endsWith('*') && !b[0].endsWith('*')) {
    return 1;
  }

  if (!a[0].endsWith('*') && b[0].endsWith('*')) {
    return -1;
  }

  return a[0].localeCompare(b[0]) * -1;
}

export async function findGlobalJson(
  packageFile: string,
): Promise<GlobalJson | null> {
  const globalJsonPath = await findLocalSiblingOrParent(
    packageFile,
    'global.json',
  );
  if (!globalJsonPath) {
    return null;
  }

  const content = await readLocalFile(globalJsonPath, 'utf8');
  if (!content) {
    logger.debug({ packageFile, globalJsonPath }, 'Failed to read global.json');
    return null;
  }

  const result = await GlobalJson.safeParseAsync(content);
  if (!result.success) {
    logger.debug(
      { packageFile, globalJsonPath, err: result.error },
      'Failed to parse global.json',
    );
    return null;
  }
  return result.data;
}
