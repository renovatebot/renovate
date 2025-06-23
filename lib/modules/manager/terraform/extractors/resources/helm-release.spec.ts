import { HelmReleaseExtractor } from './helm-release';

describe('modules/manager/terraform/extractors/resources/helm-release', () => {
  const extractor = new HelmReleaseExtractor();

  it('return empty array if no resource is found', () => {
    const res = extractor.extract({}, [], {});
    expect(res).toBeArrayOfSize(0);
  });
});
