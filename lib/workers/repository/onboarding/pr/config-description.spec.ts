import type { PackageFile } from '../../../../modules/manager/types';
import { getConfigDesc } from './config-description';
import type { RenovateConfig } from '~test/util';
import { partial } from '~test/util';

describe('workers/repository/onboarding/pr/config-description', () => {
  describe('getConfigDesc()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>();
    });

    it('returns empty', () => {
      delete config.description;
      const res = getConfigDesc(config);
      expect(res).toBe('');
    });

    it('returns a full list', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [],
        dockerfile: [],
      };
      config.description = [
        'description 1',
        'description two',
        'something else',
        'this is Docker-only',
      ];
      const res = getConfigDesc(config, packageFiles);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('Docker-only')).not.toBe(-1);
    });

    it('assignees, labels and schedule', () => {
      delete config.description;
      config.packageFiles = [];
      config.assignees = ['someone', '@someone-else'];
      config.labels = ['renovate', 'deps'];
      config.schedule = ['before 5am'];
      const res = getConfigDesc(config);
      expect(res).toMatchInlineSnapshot(`
        "
        ### Configuration Summary

        Based on the default config's presets, Renovate will:

          - Start dependency updates only once this onboarding PR is merged
          - Run Renovate on following schedule: before 5am

        🔡 Do you want to change how Renovate upgrades your dependencies? Add your custom config to \`renovate.json\` in this branch. Renovate will update the Pull Request description the next time it runs.

        ---
        "
      `);
    });

    it('contains the onboardingConfigFileName if set', () => {
      delete config.description;
      config.schedule = ['before 5am'];
      config.onboardingConfigFileName = '.github/renovate.json';
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('`.github/renovate.json`')).not.toBe(-1);
      expect(res.indexOf('`renovate.json`')).toBe(-1);
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', () => {
      delete config.description;
      config.schedule = ['before 5am'];
      config.onboardingConfigFileName = undefined;
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('`renovate.json`')).not.toBe(-1);
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not valid', () => {
      delete config.description;
      config.schedule = ['before 5am'];
      config.onboardingConfigFileName = 'foo.bar';
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('`renovate.json`')).not.toBe(-1);
    });

    it('include retry/refresh checkbox message only if onboardingRebaseCheckbox is true', () => {
      delete config.description;
      config.schedule = ['before 5am'];
      config.onboardingConfigFileName = '.github/renovate.json';
      config.onboardingRebaseCheckbox = true;
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
    });
  });
});
