const { renovateRepository } = require('../../../lib/workers/repository/index');
/** @type any */
const process = require('../../../lib/workers/repository/process');

jest.mock('../../../lib/workers/repository/init');
jest.mock('../../../lib/workers/repository/process');
jest.mock('../../../lib/workers/repository/result');
jest.mock('../../../lib/workers/repository/error');

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    let config;
    beforeEach(() => {
      config = require('../../config/config/_fixtures');
    });
    it('runs', async () => {
      process.processRepo = jest.fn(() => ({}));
      const res = await renovateRepository(config);
      expect(res).toMatchSnapshot();
    });
  });
});
