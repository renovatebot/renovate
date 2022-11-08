import upath from 'upath';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { findUpLocal, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { defaultRegistryUrls } from '../../datasource/nuget';
import type { Registry } from './types';

export async function readFileAsXmlDocument(
  file: string
): Promise<XmlDocument | undefined> {
  try {
    // TODO #7154
    const doc = new XmlDocument((await readLocalFile(file, 'utf8'))!);
    // don't return empty documents
    return doc?.firstChild ? doc : undefined;
  } catch (err) {
    logger.debug({ err, file }, `failed to parse file as XML document`);
    return undefined;
  }
}

const defaultRegistries = defaultRegistryUrls.map(
  (registryUrl) => ({ url: registryUrl } as Registry)
);

export function getDefaultRegistries(): Registry[] {
  return [...defaultRegistries];
}

export async function getConfiguredRegistries(
  packageFile: string
): Promise<Registry[] | undefined> {
  // Valid file names taken from https://github.com/NuGet/NuGet.Client/blob/f64621487c0b454eda4b98af853bf4a528bef72a/src/NuGet.Core/NuGet.Configuration/Settings/Settings.cs#L34
  const nuGetConfigFileNames = ['nuget.config', 'NuGet.config', 'NuGet.Config'];
  // normalize paths, otherwise startsWith can fail because of path delimitter mismatch
  const nuGetConfigPath = await findUpLocal(
    nuGetConfigFileNames,
    upath.dirname(packageFile)
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
    return undefined;
  }

  const registries = getDefaultRegistries();
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
          logger.debug(`Adding registry URL ${registryUrl}`);
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
