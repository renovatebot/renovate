import { codeBlock } from 'common-tags';
import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type { PackageFile } from '../../../../modules/manager/types.ts';
import { getConfigDesc } from './config-description.ts';

describe('workers/repository/onboarding/pr/config-description', () => {
  describe('getConfigDesc()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      GlobalConfig.reset();
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
      expect(res).toBe(
        `\n${`${codeBlock`
            ### Configuration Summary

            Based on the default config's presets, Renovate will:

              - Start dependency updates only once this onboarding PR is merged
              - description 1
              - description two
              - something else
              - this is Docker-only

            ---
          `}`}\n`,
      );
    });

    it('assignees, labels and schedule', () => {
      delete config.description;
      config.assignees = ['someone', '@someone-else'];
      config.labels = ['renovate', 'deps'];
      config.schedule = ['before 5am'];
      const res = getConfigDesc(config);
      // only the schedule makes it into the summary
      expect(res).toContain(
        '  - Run Renovate on following schedule: before 5am\n',
      );
      expect(res).not.toContain('- someone');
      expect(res).not.toContain('- renovate');
      expect(res).not.toContain('- deps');
    });

    it('include retry/refresh checkbox message only if onboardingRebaseCheckbox is true', () => {
      delete config.description;
      config.schedule = ['before 5am'];
      GlobalConfig.set({ onboardingConfigFileName: '.github/renovate.json' });
      config.onboardingRebaseCheckbox = true;
      const res = getConfigDesc(config);
      expect(res).toContain(
        '  - Run Renovate on following schedule: before 5am\n',
      );
      // the checkbox message is added by the PR body, not by the config summary
      expect(res).not.toContain('checkbox');
    });
  });
});
