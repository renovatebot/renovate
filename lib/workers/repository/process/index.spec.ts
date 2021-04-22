import {
  RenovateConfig,
  getConfig,
  git,
  mocked,
  testName,
} from '../../../../test/util';
import * as _extractUpdate from './extract-update';
import { extractDependencies, updateRepo } from '.';

jest.mock('../../../util/git');
jest.mock('./extract-update');

const extract = mocked(_extractUpdate).extract;

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(testName(), () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      expect(res).toMatchSnapshot();
    });
    it('processes baseBranches', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['branch1', 'branch2'];
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      expect(res).toMatchSnapshot();
    });
  });
});
