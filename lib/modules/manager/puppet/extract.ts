import { logger } from '../../../logger';
import { PuppetDatasource } from '../../datasource/puppet';
import type { PackageDependency, PackageFile } from '../types';
import { forgeRegexFactory, simpleModuleLineRegexFactory } from './constants';

interface ForgeContent {
  forgeUrl: string;
  moduleContent: string;
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('puppet.extractPackageFile()');

  const deps: PackageDependency[] = [];

  const forgeContents: ForgeContent[] = [];

  const forgeRegex = forgeRegexFactory();
  let forge: RegExpExecArray;

  if(!forgeRegexFactory().test(content)) {
    forgeContents.push({
      forgeUrl: 'https://forgeapi.puppet.com', // TODO: default Registry
      moduleContent: content,
    });
  }

  while ((forge = forgeRegex.exec(content)) !== null) {
    const forgeUrl = forge[1];
    const moduleContent = forge[2];

    forgeContents.push({
      forgeUrl,
      moduleContent,
    });
  }

  for (const {forgeUrl, moduleContent} of forgeContents) {

    const simpleModuleLineRegex = simpleModuleLineRegexFactory();

    let line: RegExpExecArray;
    while ((line = simpleModuleLineRegex.exec(moduleContent)) !== null) {
      const module = line[1];
      const version = line[2];

      const dep: PackageDependency = {
        depName: module,
        datasource: PuppetDatasource.id,
        packageName: module,
        currentValue: version,
        registryUrls: [forgeUrl],
      };

      deps.push(dep);
    }
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
