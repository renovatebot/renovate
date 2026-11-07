import { applyGlobalConfigDefaults } from './defaults.ts';

describe('workers/global/config/defaults', () => {
  describe('applyGlobalConfigDefaults()', () => {
    it('gives the options which are left out or null their default value', () => {
      const config = applyGlobalConfigDefaults({
        deleteConfigFile: null as never,
        labels: null as never,
        mergeConfidenceEndpoint: 'https://example.com/',
      });

      expect(config).toMatchObject({
        deleteAdditionalConfigFile: false,
        deleteConfigFile: false,
        labels: [],
        mergeConfidenceDatasources: expect.arrayContaining(['npm']),
        mergeConfidenceEndpoint: 'https://example.com/',
        secrets: {},
      });
    });

    it('updates the config in place', () => {
      const config = {};

      expect(applyGlobalConfigDefaults(config)).toBe(config);
    });

    it('leaves out the global options which a null value does not default', () => {
      const config = applyGlobalConfigDefaults({ repositories: null as never });

      expect(config.repositories).toBeNull();
      expect(config).not.toHaveProperty('gitNoVerify');
      expect(config).not.toHaveProperty('hostRules');
      expect(config).not.toHaveProperty('platform');
    });
  });
});
