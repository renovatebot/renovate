import is from '@sindresorhus/is';
import type { PackageDependency } from '../../../types';
import type { TerraformDefinitionFile } from '../../hcl/types';
import { TerraformVersionExtractor } from '../terraform-block/terraform-version';

export class TerraformWorkspaceExtractor extends TerraformVersionExtractor {
  override getCheckList(): string[] {
    return [`"tfe_workspace"`];
  }

  override extract(hclMap: TerraformDefinitionFile): PackageDependency[] {
    const dependencies = [];

    const workspaces = hclMap?.resource?.tfe_workspace;
    if (is.nullOrUndefined(workspaces)) {
      return [];
    }

    for (const workspace of Object.values(workspaces).flat()) {
      const dep: PackageDependency = this.analyseTerraformVersion({
        currentValue: workspace.terraform_version,
      });

      if (is.nullOrUndefined(workspace.terraform_version)) {
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
