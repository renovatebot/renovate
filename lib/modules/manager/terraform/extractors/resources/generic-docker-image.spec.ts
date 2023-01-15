import { GenericDockerImageRef } from './generic-docker-image-ref';

describe('modules/manager/terraform/extractors/resources/generic-docker-image', () => {
  const extractor = new GenericDockerImageRef();

  it('return empty array if no resource is found', () => {
    const res = extractor.extract({});
    expect(res).toBeArrayOfSize(0);
  });
});
