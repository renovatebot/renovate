import type { Category } from '../../../constants';
import type { RangeStrategy } from '../../../types';
import { HackageDatasource } from '../../datasource/hackage';
import * as pvpVersioning from '../../versioning/pvp';
import type {
  PackageDependency,
  PackageFileContent,
  RangeConfig,
} from '../types';
import type { CabalDependency } from './extract';
import { extractNamesAndRanges, findDepends } from './extract';

export const defaultConfig = {
  managerFilePatterns: ['/\\.cabal$/'],
  pinDigests: false,
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
        versioning: pvpVersioning.id,
        replaceString: cabalDep.replaceString.trim(),
        autoReplaceStringTemplate: '{{{depName}}} {{{newValue}}}',
      };
      deps.push(dep);
    }
    current = current.slice(maybeContent.lengthProcessed);
  }
  return { deps };
}

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy === 'auto') {
    return 'widen';
  }
  return rangeStrategy;
}
