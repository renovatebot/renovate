import { ProvidersExtractor } from './providers';

describe('modules/manager/terraform/extractors/others/providers', () => {
  const extractor = new ProvidersExtractor();

  it('return null if no provider returned', () => {
    const result = extractor.extract({}, []);
    expect(result).toBeArrayOfSize(0);
  });
});
