import { loadFixture } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { SkipReason } from '../../types';
import type { ExtractConfig } from '../types';
import { extractAllPackageFiles, extractPackageFile } from './extract';

const config: ExtractConfig = {};
const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('manager/flux/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('extractPackageFile()', () => {
    it('extracts multiple resources', () => {
      const result = extractPackageFile(loadFixture('multidoc.yaml'));
      expect(result).toMatchSnapshot();
    });
    it('extracts releases without repositories', () => {
      const result = extractPackageFile(loadFixture('release.yaml'));
      expect(result.deps[0].skipReason).toBe(SkipReason.UnknownRegistry);
    });
    it('ignores bad manifests', () => {
      const result = extractPackageFile('"bad YAML');
      expect(result).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('extracts multiple files', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/manager/flux/__fixtures__/release.yaml',
        'lib/manager/flux/__fixtures__/source.yaml',
      ]);
      expect(result).toMatchSnapshot();
      expect(result).toHaveLength(1);
    });
    it('ignores files that do not exist', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/manager/flux/__fixtures__/bogus.yaml',
      ]);
      expect(result).toBeNull();
    });
  });
});
