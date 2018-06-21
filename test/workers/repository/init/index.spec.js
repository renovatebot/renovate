const base = require('../../../../lib/workers/repository/init/base');
const { initRepo } = require('../../../../lib/workers/repository/init');

jest.mock('../../../../lib/workers/repository/onboarding/branch');
jest.mock('../../../../lib/workers/repository/configured');
jest.mock('../../../../lib/workers/repository/init/apis');
jest.mock('../../../../lib/workers/repository/init/base');
jest.mock('../../../../lib/workers/repository/init/config');
jest.mock('../../../../lib/workers/repository/init/semantic');

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      base.checkBaseBranch.mockReturnValue({});
      await initRepo({}, null);
    });
  });
});
