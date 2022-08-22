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

const matchers: MatcherApi[][] = [];
export default matchers;

// each manager under the same key will use a logical OR, if multiple matchers are applied AND will be used
matchers.push([
  new PackageNameMatcher(),
  new PackagePatternsMatcher(),
  new PackagePrefixesMatcher(),
]);
matchers.push([new FilesMatcher()]);
matchers.push([new PathsMatcher()]);
matchers.push([new DepTypesMatcher()]);
matchers.push([new LanguagesMatcher()]);
matchers.push([new BaseBranchesMatcher()]);
matchers.push([new ManagersMatcher()]);
matchers.push([new DatasourcesMatcher()]);
matchers.push([new UpdateTypesMatcher()]);
matchers.push([new SourceUrlsMatcher(), new SourceUrlPrefixesMatcher()]);
matchers.push([new CurrentVersionMatcher()]);
