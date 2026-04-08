import { mock } from 'vitest-mock-extended';
import type { RenovateConfig } from '~test/util.ts';
import { getConfig } from '../../config/defaults.ts';
import { logger } from '../../logger/index.ts';
import * as _fsUtil from '../../util/fs/index.ts';
import * as _common from './common.ts';
import { renovateRepository } from './index.ts';
import * as _init from './init/index.ts';
import type { ExtractResult } from './process/extract-update.ts';
import * as _process from './process/index.ts';

const process = vi.mocked(_process);
const fsUtil = vi.mocked(_fsUtil);
const init = vi.mocked(_init);
const common = vi.mocked(_common);

vi.mock('./init/index.ts');
vi.mock('./process/index.ts');
vi.mock('./result.ts');
vi.mock('./error.ts');
vi.mock('../../util/fs/index.ts');
vi.mock('./cache.ts');
vi.mock('./onboarding/pr/index.ts');
vi.mock('./finalize/index.ts');
vi.mock('./common.ts');
vi.mock('../../util/git/semantic.ts');

describe('workers/repository/index', () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = getConfig();
      config.localDir = '';
    });

    it('does not process a repository, but also does not error', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      // this returns `undefined`, as we do not actually process a repository, so no `ProcessResult` is returned
      // but importantly, no errors are thrown, either
      expect(res).toBeUndefined();
    });

    it('cleans up local directory before recursive retry after automerge', async () => {
      const callOrder: string[] = [];

      config.localDir = '/tmp/renovate/repos/test/repo';
      init.initRepo.mockResolvedValue(config);
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      process.updateRepo.mockImplementation(() => {
        callOrder.push('updateRepo');
        return Promise.resolve('automerged');
      });
      fsUtil.deleteLocalFile.mockImplementation(() => {
        callOrder.push('deleteLocalFile');
        return Promise.resolve();
      });
      common.extractRepoProblems.mockReturnValue(new Set());

      await renovateRepository(config);

      expect(callOrder).toEqual([
        'updateRepo', // first run detects automerge
        'deleteLocalFile', // fix: cleanup stale .git/config before retry
        'updateRepo', // recursive retry (canRetry=false)
        'deleteLocalFile', // normal end-of-run cleanup (recursive run)
      ]);
    });

    it('warns when local directory cleanup fails', async () => {
      config.localDir = '/tmp/renovate/repos/test/repo';
      init.initRepo.mockResolvedValue(config);
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      process.updateRepo.mockResolvedValue('automerged');
      fsUtil.deleteLocalFile.mockRejectedValue(new Error('EBUSY'));
      common.extractRepoProblems.mockReturnValue(new Set());

      await renovateRepository(config);

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'localDir deletion error',
      );
    });
  });
});
