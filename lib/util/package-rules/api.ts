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

const api: MatcherApi[][] = [];
export default api;

// each manager under the same key will use a logical OR, if multiple matchers are applied AND will be used
api.push([
  new PackageNameMatcher(),
  new PackagePatternsMatcher(),
  new PackagePrefixesMatcher(),
]);
api.push([new FilesMatcher()]);
api.push([new PathsMatcher()]);
api.push([new DepTypesMatcher()]);
api.push([new LanguagesMatcher()]);
api.push([new BaseBranchesMatcher()]);
api.push([new ManagersMatcher()]);
api.push([new DatasourcesMatcher()]);
api.push([new UpdateTypesMatcher()]);
api.push([new SourceUrlsMatcher(), new SourceUrlPrefixesMatcher()]);
api.push([new CurrentVersionMatcher()]);
