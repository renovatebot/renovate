import { BaseBranchesMatcher } from './base-branches';
import { CategoriesMatcher } from './categories';
import { CurrentAgeMatcher } from './current-age';
import { CurrentValueMatcher } from './current-value';
import { CurrentVersionMatcher } from './current-version';
import { DatasourcesMatcher } from './datasources';
import { DepNameMatcher } from './dep-names';
import { DepTypesMatcher } from './dep-types';
import { FileNamesMatcher } from './files';
import { JsonataMatcher } from './jsonata';
import { ManagersMatcher } from './managers';
import { MergeConfidenceMatcher } from './merge-confidence';
import { NewValueMatcher } from './new-value';
import { PackageNameMatcher } from './package-names';
import { RepositoriesMatcher } from './repositories';
import { SourceUrlsMatcher } from './sourceurls';
import type { MatcherApi } from './types';
import { UpdateTypesMatcher } from './update-types';

const matchers: MatcherApi[] = [];
export default matchers;

// Each matcher under the same index will use a logical OR, if multiple matchers are applied AND will be used

// applyPackageRules evaluates matchers in the order of insertion and returns early on failure.
// Therefore, when multiple matchers are set in a single packageRule, some may not be checked.
// Since matchConfidence matcher can abort the run due to unauthenticated use, it should be evaluated first.
matchers.push(new MergeConfidenceMatcher());
matchers.push(new RepositoriesMatcher());
matchers.push(new BaseBranchesMatcher());
matchers.push(new CategoriesMatcher());
matchers.push(new ManagersMatcher());
matchers.push(new FileNamesMatcher());
matchers.push(new DatasourcesMatcher());
matchers.push(new PackageNameMatcher());
matchers.push(new DepNameMatcher());
matchers.push(new DepTypesMatcher());
matchers.push(new CurrentValueMatcher());
matchers.push(new CurrentVersionMatcher());
matchers.push(new UpdateTypesMatcher());
matchers.push(new SourceUrlsMatcher());
matchers.push(new NewValueMatcher());
matchers.push(new CurrentAgeMatcher());
matchers.push(new JsonataMatcher());
