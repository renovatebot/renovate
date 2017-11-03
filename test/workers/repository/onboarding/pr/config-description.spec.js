const logger = require('../../../../_fixtures/logger');
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
        logger,
      };
    });
    it('returns empty', async () => {
      delete config.description;
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
    });
    it('returns a list', () => {
      config.description = [
        'description 1',
        'description two',
        'something else',
      ];
      const res = getConfigDesc(config);
      expect(res).toMatchSnapshot();
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
