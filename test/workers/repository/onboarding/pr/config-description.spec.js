const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  getConfigDesc,
} = require('../../../../../lib/workers/repository/onboarding/pr/config-description');

describe('workers/repository/onboarding/pr/config-description', () => {
  describe('getConfigDesc()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty', () => {
      delete config.description;
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
    });
    it('returns a full list', () => {
      config.packageFiles = [
        { packageFile: 'package.json' },
        { packageFile: 'Dockerfile' },
      ];
      config.description = [
        'description 1',
        'description two',
        'something else',
        'this is Docker-only',
      ];
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('Docker-only')).not.toBe(-1);
    });
    it('returns a filtered list', () => {
      config.packageFiles = [{ packageFile: 'package.json' }];
      config.description = [
        'description 1',
        'description two',
        'something else',
        'this is Docker-only',
      ];
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
      expect(res.indexOf('Docker-only')).toBe(-1);
    });
    it('assignees, labels and schedule', () => {
      config.assignees = ['someone', '@someone-else'];
      config.labels = ['renovate', 'deps'];
      config.schedule = ['before 5am'];
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
    });
  });
});
