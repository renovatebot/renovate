jest
  .enableAutomock()
  .dontMock('chalk')
  .dontMock('../../../../lib/workers/repository/init');

const { initRepo } = require('../../../../lib/workers/repository/init');

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      await initRepo({}, null);
    });
  });
});
