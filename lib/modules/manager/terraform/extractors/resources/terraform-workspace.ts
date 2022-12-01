import is from '@sindresorhus/is';
import type { PackageDependency } from '../../../types';
import { TerraformVersionExtractor } from '../terraform-block/terraform-version';

export class TerraformWorkspaceExtractor extends TerraformVersionExtractor {
  override extract(hclMap: any): PackageDependency[] {
    const dependencies = [];

    const workspaces = hclMap?.resource?.tfe_workspace;
    if (is.nullOrUndefined(workspaces)) {
      return [];
    }

    for (const workspaceName of Object.keys(workspaces)) {
      for (const workspace of workspaces[workspaceName]) {
        const dep: PackageDependency = this.analyseTerraformVersion({
          currentValue: workspace.terraform_version,
        });

        if (is.nullOrUndefined(workspace.terraform_version)) {
          dep.skipReason = 'no-version';
        }
        dependencies.push({
          ...dep,
          depType: 'tfe_workspace',
        });
      }
    }
    return dependencies;
  }
}
