let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
  config.errors = [];
  config.warnings = [];
});

const {
  checkBaseBranch,
} = require('../../../../lib/workers/repository/init/base');

describe('workers/repository/init/base', () => {
  describe('checkBaseBranch()', () => {
    it('errors', async () => {
      config.baseBranch = 'some-base';
      const res = await checkBaseBranch(config);
      expect(res.errors).toHaveLength(1);
    });
    it('sets baseBranch', async () => {
      config.baseBranch = 'ssome-base';
      platform.branchExists.mockReturnValue(true);
      const res = await checkBaseBranch(config);
      expect(res.errors).toHaveLength(0);
      expect(platform.setBaseBranch.mock.calls).toHaveLength(1);
    });
  });
});
