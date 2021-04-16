import { RenovateConfig, getConfig, getName } from '../../../../../test/util';
import type { PackageFile } from '../../../../manager/types';
import { getConfigDesc } from './config-description';

describe(getName(__filename), () => {
  describe('getConfigDesc()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
    });
    it('returns empty', () => {
      delete config.description;
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
  });
});
