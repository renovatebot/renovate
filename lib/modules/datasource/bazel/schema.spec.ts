import { Fixtures } from '~test/fixtures.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { BazelModuleMetadata } from './schema.ts';

describe('modules/datasource/bazel/schema', () => {
  describe('BazelModuleMetadata', () => {
    it('parses metadata', () => {
      const metadataJson = Fixtures.get('metadata-with-yanked-versions.json');
      const metadata = Json.pipe(BazelModuleMetadata).parse(metadataJson);
      expect(metadata.versions).toHaveLength(4);
    });
  });
});
