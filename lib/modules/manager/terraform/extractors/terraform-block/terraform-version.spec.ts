import { TerraformVersionExtractor } from './terraform-version';

describe('modules/manager/terraform/extractors/terraform-block/terraform-version', () => {
  const extractor = new TerraformVersionExtractor();

  it('return empty array if no terraform block is found', () => {
    const res = extractor.extract({});
    expect(res).toBeArrayOfSize(0);
  });
});
