import { logger } from '../../../logger';
import { PuppetDatasource } from '../../datasource/puppet';
import type { PackageDependency, PackageFile } from '../types';
import { simpleModuleLineRegexFactory } from './constants';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('puppet.extractPackageFile()');

  const deps: PackageDependency[] = [];
  const simpleModuleLineRegex = simpleModuleLineRegexFactory();

  let line: RegExpExecArray;
  while ((line = simpleModuleLineRegex.exec(content)) !== null) {
    const module = line[1];
    const version = line[2];

    const dep: PackageDependency = {
      depName: module,
      datasource: PuppetDatasource.id,
      packageName: module,
      currentValue: version,
      registryUrls: ['https://forgeapi.puppet.com'],
    };

    deps.push(dep);
  }

  if (deps.length) {
    return { deps };
  }

  return null;
}
