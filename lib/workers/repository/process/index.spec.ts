import { configFileNames } from '../../../config/app-strings';
import { getConfig } from '../../../config/defaults';
import { GlobalConfig } from '../../../config/global';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { addMeta } from '../../../logger';
import { getCache } from '../../../util/cache/repository';
import * as _vulnerability from '../init/vulnerability';
import * as _extractUpdate from './extract-update';
import { lookup } from './extract-update';
import { extractDependencies, updateRepo } from '.';
import { git, logger, platform, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('./extract-update');
vi.mock('../init/vulnerability');

const extract = vi.mocked(_extractUpdate).extract;
const detectVulnerabilityAlerts =
  vi.mocked(_vulnerability).detectVulnerabilityAlerts;

let config: RenovateConfig;

beforeEach(() => {
  config = getConfig();
  detectVulnerabilityAlerts.mockImplementation((x) => Promise.resolve(x));
});

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      expect(res).toBeUndefined();
    });

    it('processes baseBranches', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['branch1', 'branch2'];
      scm.branchExists.mockResolvedValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.branchExists.mockResolvedValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      expect(res).toEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });
    });

    it('reads config from default branch if useBaseBranchConfig not specified', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile.mockResolvedValueOnce({});
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'none';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev',
      );
    });

    it('reads config from branches in baseBranches if useBaseBranchConfig="merge"', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi
        .fn()
        .mockResolvedValueOnce({ addLabels: ['a'] })
        .mockResolvedValueOnce({ addLabels: ['b'] })
        .mockResolvedValueOnce({ addLabels: ['a'] })
        .mockResolvedValueOnce({ addLabels: ['b'] });
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      config.repository = 'renovate-test';
      config.addLabels = ['x'];
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json',
        'renovate-test',
        'dev',
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
      expect(extract).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ addLabels: ['x', 'a'] }),
        true,
      );
      expect(extract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ addLabels: ['x', 'b'] }),
        true,
      );
    });

    it('handles config name mismatch between baseBranches if useBaseBranchConfig="merge"', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi
        .fn()
        .mockImplementation((fileName, repoName, branchName) => {
          if (branchName === 'dev') {
            throw new Error();
          }
          return {};
        });
      getCache().configFileName = 'renovate.json';
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      await expect(extractDependencies(config)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('reads config from branches in baseBranches if useBaseBranchConfig="replace"', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi
        .fn()
        .mockResolvedValueOnce({ addLabels: ['a'] })
        .mockResolvedValueOnce({ addLabels: ['b'] })
        .mockResolvedValueOnce({ addLabels: ['a'] })
        .mockResolvedValueOnce({ addLabels: ['b'] });
      config.baseBranches = ['one', 'two'];
      config.useBaseBranchConfig = 'replace';
      config.repository = 'renovate-test';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getJsonFile).toHaveBeenNthCalledWith(
        1,
        'renovate.json',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenNthCalledWith(
        2,
        'renovate.json',
        'renovate-test',
        'two',
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'one' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'two' });
      expect(extract).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ addLabels: ['a'] }),
        true,
      );
      expect(extract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ addLabels: ['b'] }),
        true,
      );
    });

    it('can detect config file name on base branch when detectBaseBranchConfigFileName=true', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi.fn().mockImplementation((fileName) => {
        if (fileName === '.renovaterc') {
          return { addLabels: ['a'] };
        }
        throw new Error();
      });
      config.baseBranches = ['one'];
      config.useBaseBranchConfig = 'replace';
      config.detectBaseBranchConfigFileName = true;
      config.repository = 'renovate-test';
      getCache().configFileName = '.gitlab/renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });

      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json5',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.github/renovate.json',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.github/renovate.json5',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.gitlab/renovate.json',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.gitlab/renovate.json5',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        '.renovaterc',
        'renovate-test',
        'one',
      );
      // Found the config file. The remaining possible
      // config file names should not have been used.
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        '.renovaterc.json',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        '.renovaterc.json5',
        'renovate-test',
        'one',
      );
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        'package.json',
        'renovate-test',
        'one',
      );

      expect(extract).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ addLabels: ['a'] }),
        true,
      );
    });

    it('uses config file name from default branch when base branch config file name is not found and detectBaseBranchConfigFileName=true', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi.fn().mockImplementation((fileName) => {
        if (fileName === 'use-this-file.json') {
          return { addLabels: ['a'] };
        }
        throw new Error();
      });
      config.baseBranches = ['one'];
      config.useBaseBranchConfig = 'replace';
      config.detectBaseBranchConfigFileName = true;
      config.repository = 'renovate-test';
      getCache().configFileName = 'use-this-file.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });

      for (const configFileName of configFileNames) {
        // package.json should never be used for base branches.
        if (configFileName === 'package.json') {
          expect(platform.getJsonFile).not.toHaveBeenCalledWith(
            configFileName,
            'renovate-test',
            'one',
          );
        } else {
          expect(platform.getJsonFile).toHaveBeenCalledWith(
            configFileName,
            'renovate-test',
            'one',
          );
        }
      }
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'use-this-file.json',
        'renovate-test',
        'one',
      );

      expect(extract).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ addLabels: ['a'] }),
        true,
      );
    });

    it('initializes config and detects vulnerability alerts when useBaseBranchConfig="replace"', async () => {
      scm.branchExists.mockResolvedValue(true);

      detectVulnerabilityAlerts.mockImplementation((x) =>
        Promise.resolve({ ...x, remediations: {} }),
      );

      platform.getJsonFile = vi.fn().mockResolvedValue({ addLabels: ['a'] });
      config.baseBranches = ['one'];
      config.useBaseBranchConfig = 'replace';
      config.repository = 'renovate-test';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });
      expect(detectVulnerabilityAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          addLabels: ['a'],
          // These properties should have been added via initialization.
          errors: [],
          warnings: [],
          branchList: [],
        }),
      );
      expect(extract).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          addLabels: ['a'],
          errors: [],
          warnings: [],
          branchList: [],
          // This property should have been added via the
          // mocked detectVulnerabilityAlerts function.
          remediations: {},
        }),
        true,
      );
    });

    it('processes baseBranches dryRun extract', async () => {
      extract.mockResolvedValue({} as never);
      GlobalConfig.set({ dryRun: 'extract' });
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      expect(res).toEqual({
        branchList: [],
        branches: [],
        packageFiles: {},
      });
      expect(lookup).toHaveBeenCalledTimes(0);
    });

    it('finds baseBranches via regular expressions', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['/^release\\/.*/i', 'dev', '!/^pre-release\\/.*/'];
      git.getBranchList.mockReturnValue([
        'dev',
        'pre-release/v0',
        'RELEASE/v0',
        'release/v1',
        'release/v2',
        'some-other',
      ]);
      scm.branchExists.mockResolvedValue(true);
      const res = await extractDependencies(config);
      expect(res).toStrictEqual({
        branchList: [undefined, undefined, undefined, undefined, undefined],
        branches: [undefined, undefined, undefined, undefined, undefined],
        packageFiles: undefined,
      });

      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          baseBranches: [
            'RELEASE/v0',
            'release/v1',
            'release/v2',
            'dev',
            'some-other',
          ],
        },
        'baseBranches',
      );
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'RELEASE/v0' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'release/v1' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'release/v2' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'dev' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'some-other' });
    });

    it('maps $default to defaultBranch', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['$default'];
      config.defaultBranch = 'master';
      git.getBranchList.mockReturnValue(['dev', 'master']);
      scm.branchExists.mockResolvedValue(true);
      const res = await extractDependencies(config);
      expect(res).toStrictEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'master' });
    });
  });
});
