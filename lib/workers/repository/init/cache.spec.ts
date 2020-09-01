import { RenovateConfig, getConfig } from '../../../../test/util';
import {
  getResolvedConfig,
  initializeCaches,
  setResolvedConfig,
} from './cache';

describe('workers/repository/init/cache', () => {
  describe('getCachedConfig()', () => {
    let config: RenovateConfig;
    beforeEach(async () => {
      config = { ...getConfig() };
      await initializeCaches(config);
    });
    it('returns null if no sha provided', () => {
      expect(getResolvedConfig(null)).toBeNull();
    });
    it('returns null if no match', () => {
      expect(getResolvedConfig('abc123')).toBeNull();
    });
    it('returns null if resolved config sha does not match', () => {
      config.defaultBranchSha = 'abc123';
      setResolvedConfig(config);
      expect(getResolvedConfig('def456')).toBeNull();
    });
    it('returns matching resolved config', () => {
      config.defaultBranchSha = 'abc123';
      setResolvedConfig(config);
      expect(getResolvedConfig('abc123')).not.toBeNull();
    });
  });
});
