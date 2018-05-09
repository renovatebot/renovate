jest
  .enableAutomock()
  .dontMock('chalk')
  .dontMock('../../../../lib/workers/repository/init');

const base = require('../../../../lib/workers/repository/init/base');
const { initRepo } = require('../../../../lib/workers/repository/init');

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      base.checkBaseBranch.mockReturnValue({});
      await initRepo({}, null);
    });
  });
});
