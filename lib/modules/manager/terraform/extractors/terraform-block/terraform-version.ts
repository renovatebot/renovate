import { isNullOrUndefined } from '@sindresorhus/is';
import { GithubReleasesDatasource } from '../../../../datasource/github-releases/index.ts';
import * as hashicorp from '../../../../versioning/hashicorp/index.ts';
import type { PackageDependency } from '../../../types.ts';
import { DependencyExtractor } from '../../base.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';

export class TerraformVersionExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return ['required_version'];
  }

  extract(hclRoot: TerraformDefinitionFile): PackageDependency[] {
    const terraformBlocks = hclRoot?.terraform;
    if (isNullOrUndefined(terraformBlocks)) {
      return [];
    }

    const dependencies = [];
    for (const terraformBlock of terraformBlocks) {
      const requiredVersion = terraformBlock.required_version;
      if (isNullOrUndefined(requiredVersion)) {
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
