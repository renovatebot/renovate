import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';
import { anyMatchRegexOrMinimatch } from './match';

export class RepositoriesMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig,
    { matchRepositories }: PackageRule,
  ): boolean | null {
    return anyMatchRegexOrMinimatch(matchRepositories, repository);
  }

  override excludes(
    { repository }: PackageRuleInputConfig,
    { excludeRepositories }: PackageRule,
  ): boolean | null {
    return anyMatchRegexOrMinimatch(excludeRepositories, repository);
  }
}
