import {
  RenovateConfig,
  getConfig,
  git,
  mocked,
  platform,
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

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      // FIXME: explicit assert condition
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
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });

    it('reads config from default branch if useBaseBranchConfig not specified', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getJsonFile.mockResolvedValueOnce({});
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'none';
      const res = await extractDependencies(config);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "branchList": Array [
            undefined,
            undefined,
          ],
          "branches": Array [
            undefined,
            undefined,
          ],
          "packageFiles": undefined,
        }
      `);
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev'
      );
    });

    it('reads config from branches in baseBranches if useBaseBranchConfig specified', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getJsonFile = jest.fn().mockResolvedValue({});
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'replace';
      const res = await extractDependencies(config);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "branchList": Array [
            undefined,
            undefined,
          ],
          "branches": Array [
            undefined,
            undefined,
          ],
          "packageFiles": undefined,
        }
      `);
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev'
      );
    });

    it('handles config name mismatch between baseBranches if useBaseBranchConfig specified', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getJsonFile = jest.fn().mockImplementation(() => {
        throw new Error();
      });
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'replace';
      const res = await extractDependencies(config);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "branchList": Array [],
          "branches": Array [],
          "packageFiles": null,
        }
      `);
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev'
      );
    });
  });
});
