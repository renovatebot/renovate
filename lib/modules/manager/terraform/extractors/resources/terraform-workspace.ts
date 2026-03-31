import { isNullOrUndefined } from '@sindresorhus/is';
import type { PackageDependency } from '../../../types.ts';
import type { TerraformDepType } from '../../dep-types.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';
import { TerraformVersionExtractor } from '../terraform-block/terraform-version.ts';

export class TerraformWorkspaceExtractor extends TerraformVersionExtractor {
  override getCheckList(): string[] {
    return [`"tfe_workspace"`];
  }

  override extract(
    hclMap: TerraformDefinitionFile,
  ): PackageDependency<Record<string, any>, TerraformDepType>[] {
    const dependencies: PackageDependency<
      Record<string, any>,
      TerraformDepType
    >[] = [];

    const workspaces = hclMap?.resource?.tfe_workspace;
    if (isNullOrUndefined(workspaces)) {
      return [];
    }

    for (const workspace of Object.values(workspaces).flat()) {
      const dep: PackageDependency<
        Record<string, any>,
        TerraformDepType
      > = this.analyseTerraformVersion({
        currentValue: workspace.terraform_version,
      });

      if (isNullOrUndefined(workspace.terraform_version)) {
        dep.skipReason = 'unspecified-version';
      }
      dependencies.push({
        ...dep,
        depType: 'tfe_workspace',
      });
    }
    return dependencies;
  }
}
