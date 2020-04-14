import findUp from 'find-up';
import * as path from 'path';
import { XmlDocument } from 'xmldoc';
import { readFile } from 'fs-extra';
import { logger } from '../../logger';
import { get } from '../../versioning';
import { PackageDependency, ExtractConfig, PackageFile } from '../common';
import * as semverVersioning from '../../versioning/semver';
import * as datasourceNuget from '../../datasource/nuget';
import { SkipReason } from '../../types';

async function readFileAsXmlDocument(file: string): Promise<XmlDocument> {
  try {
    return new XmlDocument(await readFile(file, 'utf8'));
  } catch (err) {
    logger.debug({ err }, `failed to parse '${file}' as XML document`);
    return undefined;
  }
}

async function determineRegistryUrls(
  packageFile: string,
  localDir: string
): Promise<string[]> {
  // Valid file names taken from https://github.com/NuGet/NuGet.Client/blob/f64621487c0b454eda4b98af853bf4a528bef72a/src/NuGet.Core/NuGet.Configuration/Settings/Settings.cs#L34
  const nuGetConfigFileNames = ['nuget.config', 'NuGet.config', 'NuGet.Config'];
  const nuGetConfigPath = await findUp(nuGetConfigFileNames, {
    cwd: path.dirname(path.join(localDir, packageFile)),
    type: 'file',
  });

  if (nuGetConfigPath?.startsWith(localDir) !== true) {
    return undefined;
  }

  logger.debug({ nuGetConfigPath }, 'found NuGet.config');
  const nuGetConfig = await readFileAsXmlDocument(nuGetConfigPath);
  if (!nuGetConfig) {
    return undefined;
  }

  const packageSources = nuGetConfig.childNamed('packageSources');
  if (!packageSources) {
    return undefined;
  }

  const registryUrls = datasourceNuget.defaultRegistryUrls;
  for (const child of packageSources.children) {
    if (child.type === 'element') {
      if (child.name === 'clear') {
        logger.debug(`clearing registry URLs`);
        registryUrls.length = 0;
      } else if (child.name === 'add') {
        let registryUrl = child.attr.value;
        if (child.attr.protocolVersion) {
          registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
        }
        logger.debug({ registryUrl }, 'adding registry URL');
        registryUrls.push(registryUrl);
      }
    }
  }
  return registryUrls;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFile> {
  logger.trace({ packageFile }, 'nuget.extractPackageFile()');
  const { isVersion } = get(config.versioning || semverVersioning.id);
  const deps: PackageDependency[] = [];

  const registryUrls = await determineRegistryUrls(
    packageFile,
    config.localDir
  );

  for (const line of content.split('\n')) {
    /**
     * https://docs.microsoft.com/en-us/nuget/concepts/package-versioning
     * This article mentions that  Nuget 3.x and later tries to restore the lowest possible version
     * regarding to given version range.
     * 1.3.4 equals [1.3.4,)
     * Due to guarantee that an update of package version will result in its usage by the next restore + build operation,
     * only following constrained versions make sense
     * 1.3.4, [1.3.4], [1.3.4, ], [1.3.4, )
     * The update of the right boundary does not make sense regarding to the lowest version restore rule,
     * so we don't include it in the extracting regexp
     */

    const match = /<PackageReference.*Include\s*=\s*"([^"]+)".*Version\s*=\s*"(?:[[])?(?:([^"(,[\]]+)\s*(?:,\s*[)\]]|])?)"/.exec(
      line
    );
    if (match) {
      const depName = match[1];
      const currentValue = match[2];
      const dep: PackageDependency = {
        depType: 'nuget',
        depName,
        currentValue,
        datasource: datasourceNuget.id,
      };
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }
      if (!isVersion(currentValue)) {
        dep.skipReason = SkipReason.NotAVersion;
      }
      deps.push(dep);
    }
  }
  return { deps };
}
