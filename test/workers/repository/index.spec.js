const { determineUpdates } = require('../../../lib/workers/repository/updates');
const { writeUpdates } = require('../../../lib/workers/repository/write');
const {
  ensureOnboardingPr,
} = require('../../../lib/workers/repository/onboarding/pr');
const { renovateRepository } = require('../../../lib/workers/repository/index');

jest.mock('../../../lib/workers/repository/init');
jest.mock('../../../lib/workers/repository/init/apis');
jest.mock('../../../lib/workers/repository/updates');
jest.mock('../../../lib/workers/repository/onboarding/pr');
jest.mock('../../../lib/workers/repository/write');
jest.mock('../../../lib/workers/repository/cleanup');
jest.mock('../../../lib/manager/resolve');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
});

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    it('exits after 6 loops', async () => {
      const res = await renovateRepository(config, 'some-token', 6);
      expect(res).toMatchSnapshot();
    });
    it('writes', async () => {
      determineUpdates.mockReturnValue({ repoIsOnboarded: true });
      writeUpdates.mockReturnValueOnce('automerged');
      writeUpdates.mockReturnValueOnce('onboarded');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
    it('ensures onboarding pr', async () => {
      determineUpdates.mockReturnValue({ repoIsOnboarded: false });
      ensureOnboardingPr.mockReturnValue('onboarding');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
  });
});
