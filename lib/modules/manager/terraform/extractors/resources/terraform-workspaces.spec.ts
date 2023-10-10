import { TerraformWorkspaceExtractor } from './terraform-workspace';

describe('modules/manager/terraform/extractors/resources/terraform-workspaces', () => {
  const extractor = new TerraformWorkspaceExtractor();

  it('return empty array if no resource is found', () => {
    const res = extractor.extract({});
    expect(res).toBeArrayOfSize(0);
  });
});
