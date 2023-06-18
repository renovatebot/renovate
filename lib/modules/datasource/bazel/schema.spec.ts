import { Fixtures } from '../../../../test/fixtures';
import { BazelModuleMetadata } from './schema';

describe('modules/datasource/bazel/schema', () => {
  describe('BazelModuleMetadata', () => {
    it('parses metadata', () => {
      const metadataJson = Fixtures.get('metadata-with-yanked-versions.json');
      const metadata = BazelModuleMetadata.parse(JSON.parse(metadataJson));
      expect(metadata.versions).toHaveLength(4);
    });
  });
});
