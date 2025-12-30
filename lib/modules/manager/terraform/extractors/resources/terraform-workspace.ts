import { isNullOrUndefined } from '@sindresorhus/is';
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
    if (isNullOrUndefined(workspaces)) {
      return [];
    }

    for (const workspace of Object.values(workspaces).flat()) {
      const dep: PackageDependency = {
        currentValue: workspace.terraform_version,
      };
      const analysedDep = this.analyseTerraformVersion(dep);

      if (isNullOrUndefined(workspace.terraform_version)) {
        analysedDep.skipReason = 'unspecified-version';
      }
      dependencies.push({
        ...analysedDep,
        depType: 'tfe_workspace',
      });
    }
    return dependencies;
  }
}
