import { BaseBranchesMatcher } from './base-branches.ts';
import { CategoriesMatcher } from './categories.ts';
import { CurrentAgeMatcher } from './current-age.ts';
import { CurrentValueMatcher } from './current-value.ts';
import { CurrentVersionMatcher } from './current-version.ts';
import { DatasourcesMatcher } from './datasources.ts';
import { DepNameMatcher } from './dep-names.ts';
import { DepTypesMatcher } from './dep-types.ts';
import { FileNamesMatcher } from './files.ts';
import { JsonataMatcher } from './jsonata.ts';
import { ManagersMatcher } from './managers.ts';
import { MergeConfidenceMatcher } from './merge-confidence.ts';
import { NewValueMatcher } from './new-value.ts';
import { PackageNameMatcher } from './package-names.ts';
import { RepositoriesMatcher } from './repositories.ts';
import { SourceUrlsMatcher } from './sourceurls.ts';
import type { MatcherApi } from './types.ts';
import { UpdateTypesMatcher } from './update-types.ts';

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
