import { mock } from 'vitest-mock-extended';
import type { RenovateConfig } from '~test/util.ts';
import { getConfig } from '../../config/defaults.ts';
import { configMigration } from './config-migration/index.ts';
import { ensureDependencyDashboard } from './dependency-dashboard.ts';
import { renovateRepository } from './index.ts';
import { initRepo } from './init/index.ts';
import type { ExtractResult } from './process/extract-update.ts';
import * as _process from './process/index.ts';
import type { ProcessResult } from './result.ts';
import { processResult } from './result.ts';

const process = vi.mocked(_process);
const dashboard = vi.mocked(ensureDependencyDashboard);
const migration = vi.mocked(configMigration);

vi.mock('./config-migration/index.ts');
vi.mock('./dependency-dashboard.ts');
vi.mock('./finalize/index.ts');
vi.mock('./init/index.ts');
vi.mock('./process/index.ts');
vi.mock('./result.ts');
vi.mock('./error.ts');

describe('workers/repository/index', () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;
    let extractResult: ExtractResult;

    beforeEach(() => {
      config = getConfig();
      config.localDir = '';
      config.repository = 'some/repository';
      config.repoIsOnboarded = true;
      config.semanticCommits = 'enabled';
      extractResult = {
        branches: [],
        branchList: [],
        packageFiles: {},
      };
      vi.mocked(initRepo).mockResolvedValue(config);
      process.extractDependencies.mockResolvedValue(extractResult);
      process.updateRepo.mockResolvedValue('done');
      migration.mockResolvedValue({ result: 'no-migration' });
    });

    it('does not process a repository, but also does not error', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      vi.mocked(initRepo).mockRejectedValueOnce(new Error('init error'));

      const res = await renovateRepository(config);
      // this returns `undefined`, as we do not actually process a repository, so no `ProcessResult` is returned
      // but importantly, no errors are thrown, either
      expect(res).toBeUndefined();
    });

    it('updates the dashboard after the second automerge', async () => {
      // canRetry=false is the second pass: the first one already recursed
      process.updateRepo.mockResolvedValue('automerged');
      vi.mocked(processResult).mockReturnValue(
        mock<ProcessResult>({ res: 'done' }),
      );

      await renovateRepository(config, false);

      expect(dashboard).toHaveBeenCalledOnce();
    });
  });
});
