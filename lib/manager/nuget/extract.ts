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

async function determineRegistryUrls(
  packageFile: string,
  localDir: string
): Promise<string[]> {
  const nuGetConfigPath = await findUp('NuGet.config', {
    cwd: path.dirname(path.join(localDir, packageFile)),
    type: 'file',
  });

  if (nuGetConfigPath?.startsWith(localDir) !== true) {
    return undefined;
  }

  logger.debug(`found NuGet.config at '${nuGetConfigPath}'`);
  const nuGetConfig = new XmlDocument(
    (await readFile(nuGetConfigPath)).toString()
  );

  const packageSources = nuGetConfig.childNamed('packageSources');
  if (!packageSources) {
    return undefined;
  }

  const registryUrls = [datasourceNuget.getDefaultFeed()];
  for (const child of packageSources.children) {
    if (child.type === 'element') {
      if (child.name === 'clear') {
        logger.info(`clearing registry URLs`);
        registryUrls.length = 0;
      } else if (child.name === 'add') {
        let registryUrl = child.attr.value;
        if (child.attr.protocolVersion) {
          registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
        }
        logger.debug(`adding registry URL ${registryUrl}`);
        registryUrls.push(registryUrl);
      }
    }
  }
  return registryUrls;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig = {}
): Promise<PackageFile> {
  logger.trace(`nuget.extractPackageFile(${packageFile})`);
  const { isVersion } = get(config.versioning || semverVersioning.id);
  const deps: PackageDependency[] = [];

  const registryUrls = await determineRegistryUrls(
    packageFile,
    config.localDir
  );

  let lineNumber = 0;
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
        managerData: { lineNumber },
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
    lineNumber += 1;
  }
  return { deps };
}
