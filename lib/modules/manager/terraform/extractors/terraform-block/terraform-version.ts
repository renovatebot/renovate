import { isNullOrUndefined } from '@sindresorhus/is';
import { GithubReleasesDatasource } from '../../../../datasource/github-releases/index.ts';
import * as hashicorp from '../../../../versioning/hashicorp/index.ts';
import type { PackageDependency } from '../../../types.ts';
import { DependencyExtractor } from '../../base.ts';
import type { TerraformDepType } from '../../dep-types.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';

export class TerraformVersionExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return ['required_version'];
  }

  extract(
    hclRoot: TerraformDefinitionFile,
  ): PackageDependency<Record<string, any>, TerraformDepType>[] {
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

  protected analyseTerraformVersion(
    dep: PackageDependency,
  ): PackageDependency<Record<string, any>, TerraformDepType> {
    return {
      ...dep,
      depType: 'required_version',
      datasource: GithubReleasesDatasource.id,
      depName: 'hashicorp/terraform',
      extractVersion: 'v(?<version>.*)$',
      versioning: hashicorp.id,
    };
  }
}
