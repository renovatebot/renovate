import type { Category } from '../../../constants';
import { HackageDatasource } from '../../datasource/hackage';
import * as pvpVersioning from '../../versioning/pvp';
import type {
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { CabalDependency } from './extract';
import { extractNamesAndRanges, findDepends } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.cabal$'],
  pinDigests: false,
  versioning: pvpVersioning.id,
};

export const categories: Category[] = ['haskell'];

export const supportedDatasources = [HackageDatasource.id];

export function extractPackageFile(content: string): PackageFileContent {
  const deps = [];
  let current = content;
  for (;;) {
    const maybeContent = findDepends(current);
    if (maybeContent === null) {
      break;
    }
    const cabalDeps: CabalDependency[] = extractNamesAndRanges(
      maybeContent.buildDependsContent,
    );
    for (const cabalDep of cabalDeps) {
      const dep: PackageDependency = {
        depName: cabalDep.packageName,
        currentValue: cabalDep.currentValue,
        datasource: HackageDatasource.id,
        packageName: cabalDep.packageName,
        versioning: 'pvp',
        replaceString: cabalDep.replaceString.trim(),
        autoReplaceStringTemplate: '{{{depName}}} {{{newValue}}}',
      };
      deps.push(dep);
    }
    current = current.slice(maybeContent.lengthProcessed);
  }
  return { deps };
}
