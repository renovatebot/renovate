import { RequiredProviderExtractor } from './required-provider';

describe('modules/manager/terraform/extractors/terraform-block/required-provider', () => {
  const extractor = new RequiredProviderExtractor();

  it('return empty array if no terraform block is found', () => {
    const res = extractor.extract({}, []);
    expect(res).toBeArrayOfSize(0);
  });

  it('return empty array if no required_providers block is found', () => {
    const res = extractor.extract({ terraform: [{}] }, []);
    expect(res).toBeArrayOfSize(0);
  });
});
