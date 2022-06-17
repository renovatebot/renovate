import { git, mocked } from '../../../../test/util';
import type { RenovateConfig } from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';
import * as _repositoryCache from '../../../util/cache/repository';
import * as _branchify from '../updates/branchify';
import {
  extract,
  extractCacheFingerprint,
  lookup,
  update,
} from './extract-update';

jest.mock('./write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('../updates/branchify');
jest.mock('../extract');
jest.mock('../../../util/cache/repository');
jest.mock('../../../util/git');

const branchify = mocked(_branchify);
const repositoryCache = mocked(_repositoryCache);

branchify.branchifyUpgrades.mockResolvedValueOnce({
  branches: [
    { manager: 'some-manager', branchName: 'some-branch', upgrades: [] },
  ],
  branchList: ['branchName'],
});

describe('workers/repository/process/extract-update', () => {
  describe('extract()', () => {
    it('runs with no baseBranches', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      git.checkoutBranch.mockResolvedValueOnce('123test');
      const packageFiles = await extract(config);
      const res = await lookup(config, packageFiles);
      expect(res).toEqual({
        branchList: ['branchName'],
        branches: [
          {
            branchName: 'some-branch',
            manager: 'some-manager',
            upgrades: [],
          },
        ],
        packageFiles: undefined,
      });
      await expect(update(config, res.branches)).resolves.not.toThrow();
    });

    it('runs with baseBranches', async () => {
      const config = {
        baseBranches: ['master', 'dev'],
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      git.checkoutBranch.mockResolvedValueOnce('123test');
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      const packageFiles = await extract(config);
      expect(packageFiles).toBeUndefined();
    });

    it('uses repository cache', async () => {
      const packageFiles: Record<string, PackageFile[]> = {};
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
        baseBranch: 'master',
      };
      repositoryCache.getCache.mockReturnValueOnce({
        scan: {
          master: {
            sha: '123test',
            configHash: extractCacheFingerprint(config),
            packageFiles,
          },
        },
      });
      git.getBranchCommit.mockReturnValueOnce('123test');
      git.checkoutBranch.mockResolvedValueOnce('123test');
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });
  });

  describe('extractCacheFingerprint()', () => {
    it('works', () => {
      const { narrowedConfig } = require('../extract');
      const config: RenovateConfig = {
        enabledManagers: ['regex'],
        regexManagers: [
          {
            fileMatch: ['^Dockerfile$'],
            matchStringsStrategy: 'any',
            matchStrings: [
              'ENV [A-Z]+_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
              'FROM (?<depName>\\S*):(?<currentValue>\\S*)',
            ],
            datasourceTemplate: 'docker',
          },
        ],
      };
      narrowedConfig.mockImplementation(() => 'somstr');
      expect(extractCacheFingerprint(config)).toBeString();
    });
  });
});
