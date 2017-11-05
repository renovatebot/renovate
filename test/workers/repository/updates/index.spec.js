jest.mock('../../../../lib/workers/repository/updates/determine');
jest.mock('../../../../lib/workers/repository/updates/branchify');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
});

const {
  determineUpdates,
} = require('../../../../lib/workers/repository/updates');

describe('workers/repository/updates', () => {
  describe('determineUpdates()', () => {
    it('runs', async () => {
      await determineUpdates(config, 'some-token');
    });
  });
});
