import is from '@sindresorhus/is';
import { GithubReleasesDatasource } from '../../../../datasource/github-releases';
import * as hashicorp from '../../../../versioning/hashicorp';
import type { PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import type { TerraformDefinitionFile } from '../../hcl/types';

export class TerraformVersionExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return ['required_version'];
  }

  extract(hclRoot: TerraformDefinitionFile): PackageDependency[] {
    const terraformBlocks = hclRoot?.terraform;
    if (is.nullOrUndefined(terraformBlocks)) {
      return [];
    }

    const dependencies = [];
    for (const terraformBlock of terraformBlocks) {
      const requiredVersion = terraformBlock.required_version;
      if (is.nullOrUndefined(requiredVersion)) {
        continue;
      }

      dependencies.push(
        this.analyseTerraformVersion({
          currentValue: requiredVersion,
        }),
      );
    }
    return dependencies;
  }

  protected analyseTerraformVersion(dep: PackageDependency): PackageDependency {
    dep.depType = 'required_version';
    dep.datasource = GithubReleasesDatasource.id;
    dep.depName = 'hashicorp/terraform';
    dep.extractVersion = 'v(?<version>.*)$';
    dep.versioning = hashicorp.id;
    return dep;
  }
}
