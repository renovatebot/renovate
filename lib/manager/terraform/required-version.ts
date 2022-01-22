import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency } from '../types';

export function analyseTerraformVersion(
  dep: PackageDependency
): PackageDependency {
  dep.depType = 'required_version';
  dep.datasource = GithubTagsDatasource.id;
  dep.depName = 'hashicorp/terraform';
  dep.extractVersion = 'v(?<version>.*)$';

  return dep;
}
