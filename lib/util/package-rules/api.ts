import { BaseBranchesMatcher } from './base-branches';
import { CurrentVersionMatcher } from './current-version';
import { DatasourcesMatcher } from './datasources';
import { DepTypesMatcher } from './dep-types';
import { FilesMatcher } from './files';
import { LanguagesMatcher } from './languages';
import { ManagersMatcher } from './managers';
import { PackageNameMatcher } from './package-names';
import { PackagePatternsMatcher } from './package-patterns';
import { PackagePrefixesMatcher } from './package-prefixes';
import { PathsMatcher } from './paths';
import { SourceUrlPrefixesMatcher } from './sourceurl-prefixes';
import { SourceUrlsMatcher } from './sourceurls';
import type { MatcherApi } from './types';
import { UpdateTypesMatcher } from './update-types';

const api = new Map<string, MatcherApi[]>();
export default api;

// each manager under the same key will use a logical OR, if multiple matchers are applied AND will be used
api.set('package', [
  new PackageNameMatcher(),
  new PackagePatternsMatcher(),
  new PackagePrefixesMatcher(),
]);
api.set(FilesMatcher.id, [new FilesMatcher()]);
api.set(PathsMatcher.id, [new PathsMatcher()]);
api.set(DepTypesMatcher.id, [new DepTypesMatcher()]);
api.set(LanguagesMatcher.id, [new LanguagesMatcher()]);
api.set(BaseBranchesMatcher.id, [new BaseBranchesMatcher()]);
api.set(ManagersMatcher.id, [new ManagersMatcher()]);
api.set(DatasourcesMatcher.id, [new DatasourcesMatcher()]);
api.set(UpdateTypesMatcher.id, [new UpdateTypesMatcher()]);
api.set('source-url', [
  new SourceUrlsMatcher(),
  new SourceUrlPrefixesMatcher(),
]);
api.set(CurrentVersionMatcher.id, [new CurrentVersionMatcher()]);
