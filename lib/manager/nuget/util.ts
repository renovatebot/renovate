import * as path from 'path';
import findUp from 'find-up';
import { XmlDocument } from 'xmldoc';
import * as datasourceNuget from '../../datasource/nuget';
import { logger } from '../../logger';
import { readFile } from '../../util/fs';

async function readFileAsXmlDocument(file: string): Promise<XmlDocument> {
  try {
    return new XmlDocument(await readFile(file, 'utf8'));
  } catch (err) {
    logger.debug({ err }, `failed to parse '${file}' as XML document`);
    return undefined;
  }
}

export interface Registry {
  readonly url: string;
  readonly name?: string;
}

export async function determineRegistries(
  packageFile: string,
  localDir: string
): Promise<Registry[] | undefined> {
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

  const registries = datasourceNuget.defaultRegistryUrls.map(
    (registryUrl) =>
      ({
        url: registryUrl,
      } as Registry)
  );
  for (const child of packageSources.children) {
    if (child.type === 'element') {
      if (child.name === 'clear') {
        logger.debug(`clearing registry URLs`);
        registries.length = 0;
      } else if (child.name === 'add') {
        const isHttpUrl = /^https?:\/\//i.test(child.attr.value);
        if (isHttpUrl) {
          let registryUrl = child.attr.value;
          if (child.attr.protocolVersion) {
            registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
          }
          logger.debug({ registryUrl }, 'adding registry URL');
          registries.push({
            name: child.attr.key,
            url: registryUrl,
          });
        } else {
          logger.debug(
            { registryUrl: child.attr.value },
            'ignoring local registry URL'
          );
        }
      }
      // child.name === 'remove' not supported
    }
  }
  return registries;
}
