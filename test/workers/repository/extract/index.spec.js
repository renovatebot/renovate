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
      config = { ...require('../../../_fixtures/config') };
    });
    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockReturnValue([{}]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
  });
});
