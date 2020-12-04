import { RenovateConfig, getConfig } from '../../../../../test/util';
import { PackageFile } from '../../../../manager/common';
import { getConfigDesc } from './config-description';

describe('workers/repository/onboarding/pr/config-description', () => {
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
      config.packageFiles = [];
      config.assignees = ['someone', '@someone-else'];
      config.labels = ['renovate', 'deps'];
      config.schedule = ['before 5am'];
      config.onboardingConfigFileName = '.github/renovate.json';
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('.github/renovate.json')).not.toBe(-1);
    });
  });
});
