import { logger } from '~test/util.ts';
import type { RepoConfig } from './defaults.ts';
import { applyRepoConfigDefaults } from './defaults.ts';

describe('workers/repository/init/defaults', () => {
  describe('applyRepoConfigDefaults()', () => {
    it('gives the options which are left out or null their default value', () => {
      const config = applyRepoConfigDefaults({
        dependencyDashboardTitle: null as never,
        rebaseLabel: 'custom',
      });

      expect(config).toMatchObject({
        dependencyDashboardTitle: 'Dependency Dashboard',
        dependencyDashboardOSVVulnerabilitySummary: 'none',
        labels: [],
        rebaseLabel: 'custom',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('dependencyDashboardTitle'),
      );
    });

    it('updates the config in place', () => {
      const config = {};

      expect(applyRepoConfigDefaults(config)).toBe(config);
    });

    it('leaves out the options which the repository config does not keep', () => {
      const config = applyRepoConfigDefaults({});

      expect(config).not.toHaveProperty('onboarding');
      expect(config).not.toHaveProperty('hostRules');
      expect(config).not.toHaveProperty('extends');
    });

    it('leaves out the options which getRepositoryConfig() filters out', () => {
      const config = applyRepoConfigDefaults({});

      expect(config).not.toHaveProperty('autodiscover');
      expect(config).not.toHaveProperty('gitNoVerify');
      expect(config).not.toHaveProperty('repositories');
      expect(config).not.toHaveProperty('prCommitsPerRunLimit');
      expectTypeOf<RepoConfig['prCommitsPerRunLimit']>().toEqualTypeOf<
        number | undefined
      >();
    });

    it('does not log when every option has a value', () => {
      const config = applyRepoConfigDefaults({});
      logger.logger.debug.mockClear();

      applyRepoConfigDefaults(config);

      expect(logger.logger.debug).not.toHaveBeenCalled();
    });
  });
});
