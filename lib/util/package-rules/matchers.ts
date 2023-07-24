import { BaseBranchesMatcher } from './base-branches';
import { CategoriesMatcher } from './categories';
import { CurrentValueMatcher } from './current-value';
import { CurrentVersionMatcher } from './current-version';
import { DatasourcesMatcher } from './datasources';
import { DepNameMatcher } from './dep-names';
import { DepPatternsMatcher } from './dep-patterns';
import { DepTypesMatcher } from './dep-types';
import { FileNamesMatcher } from './files';
import { ManagersMatcher } from './managers';
import { MergeConfidenceMatcher } from './merge-confidence';
import { PackageNameMatcher } from './package-names';
import { PackagePatternsMatcher } from './package-patterns';
import { PackagePrefixesMatcher } from './package-prefixes';
import { RepositoriesMatcher } from './repositories';
import { SourceUrlPrefixesMatcher } from './sourceurl-prefixes';
import { SourceUrlsMatcher } from './sourceurls';
import type { MatcherApi } from './types';
import { UpdateTypesMatcher } from './update-types';

const matchers: MatcherApi[][] = [];
export default matchers;

// Each matcher under the same index will use a logical OR, if multiple matchers are applied AND will be used

// applyPackageRules evaluates matchers in the order of insertion and returns early on failure.
// Therefore, when multiple matchers are set in a single packageRule, some may not be checked.
// Since matchConfidence matcher can abort the run due to unauthenticated use, it should be evaluated first.
matchers.push([new MergeConfidenceMatcher()]);
matchers.push([
  new DepNameMatcher(),
  new DepPatternsMatcher(),
  new PackageNameMatcher(),
  new PackagePatternsMatcher(),
  new PackagePrefixesMatcher(),
]);
matchers.push([new FileNamesMatcher()]);
matchers.push([new DepTypesMatcher()]);
matchers.push([new BaseBranchesMatcher()]);
matchers.push([new ManagersMatcher()]);
matchers.push([new DatasourcesMatcher()]);
matchers.push([new UpdateTypesMatcher()]);
matchers.push([new SourceUrlsMatcher(), new SourceUrlPrefixesMatcher()]);
matchers.push([new CurrentValueMatcher()]);
matchers.push([new CurrentVersionMatcher()]);
matchers.push([new RepositoriesMatcher()]);
matchers.push([new CategoriesMatcher()]);
