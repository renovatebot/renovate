/** @type any */
const managerFiles = require('../../../../lib/workers/repository/extract/manager-files');
const {
  extractAllDependencies,
} = require('../../../../lib/workers/repository/extract');

jest.mock('../../../../lib/workers/repository/extract/manager-files');

describe('workers/repository/extract/index', () => {
  describe('extractAllDependencies()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = { ...require('../../../config/config/_fixtures') };
    });
    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockReturnValue([{}]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
    it('skips non-enabled maangers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockReturnValue([{}]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
  });
});
