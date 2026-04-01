import type { DirectoryResult } from 'tmp-promise';
import tmp from 'tmp-promise';
import { mock } from 'vitest-mock-extended';
import type { RenovateConfig } from '~test/util.ts';
import { getConfig } from '../../config/defaults.ts';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import * as _s3Persist from '../../util/git/s3-persist.ts';
import { renovateRepository } from './index.ts';
import * as _init from './init/index.ts';
import type { ExtractResult } from './process/extract-update.ts';
import * as _process from './process/index.ts';

const process = vi.mocked(_process);
const initRepo = vi.mocked(_init.initRepo);
const s3Persist = vi.mocked(_s3Persist);

vi.mock('./init/index.ts');
vi.mock('./process/index.ts');
vi.mock('./result.ts');
vi.mock('./error.ts');
vi.mock('../../util/git/s3-persist.ts');

describe('workers/repository/index', () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;
    let localDir: string;
    let localDirResult: DirectoryResult;

    beforeEach(async () => {
      GlobalConfig.reset();
      localDirResult = await tmp.dir({ unsafeCleanup: true });
      localDir = localDirResult.path;
      config = {
        ...getConfig(),
        localDir,
        platform: 'github',
        repository: 'org/repo',
        dryRun: 'lookup',
      } as RenovateConfig;

      initRepo.mockImplementation((input) => Promise.resolve(input));
      process.extractDependencies.mockResolvedValue({
        branches: [],
        branchList: [],
        packageFiles: {},
      });
    });

    afterEach(async () => {
      await localDirResult?.cleanup();
      GlobalConfig.reset();
    });

    it('does not process a repository, but also does not error', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      config.localDir = '';
      const res = await renovateRepository(config);
      // this returns `undefined`, as we do not actually process a repository, so no `ProcessResult` is returned
      // but importantly, no errors are thrown, either
      expect(res).toBeUndefined();
    });

    it('restores and archives git data for s3-backed persistRepoData', async () => {
      config.persistRepoData = true;
      config.persistRepoDataType = 's3://my-bucket/renovate-git/';
      s3Persist.restoreGitDataFromS3.mockResolvedValue(true);

      await renovateRepository(config);

      expect(s3Persist.restoreGitDataFromS3).toHaveBeenCalledWith(
        localDir,
        's3://my-bucket/renovate-git/',
        'github',
        'org/repo',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Restored git data from S3 - will use fast fetch',
      );
      expect(s3Persist.archiveGitDataToS3).toHaveBeenCalledWith(
        localDir,
        's3://my-bucket/renovate-git/',
        'github',
        'org/repo',
      );
    });
  });
});
