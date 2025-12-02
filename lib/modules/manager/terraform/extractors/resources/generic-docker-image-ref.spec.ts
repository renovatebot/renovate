import { GenericDockerImageRefExtractor } from './generic-docker-image-ref';
import { generic_image_datasource, generic_image_resource } from './utils';

describe('modules/manager/terraform/extractors/resources/generic-docker-image-ref', () => {
  const extractor = new GenericDockerImageRefExtractor();

  it('return empty array if no resource is found', () => {
    const res = extractor.extract({}, [], {});
    expect(res).toBeArrayOfSize(0);
  });

  it('return resource and datasource types', () => {
    const checkList = extractor.getCheckList();
    expect(checkList).toBeArrayOfSize(
      generic_image_datasource.length + generic_image_resource.length,
    );
    expect(checkList).toContain(`"${generic_image_datasource[0].type}"`);
    expect(checkList).toContain(`"${generic_image_resource[0].type}"`);
  });
});
