import { mock } from 'vitest-mock-extended';
import type { RenovateConfig } from '~test/util.ts';
import { getConfig } from '../../config/defaults.ts';
import { renovateRepository } from './index.ts';
import type { ExtractResult } from './process/extract-update.ts';
import * as _process from './process/index.ts';

const process = vi.mocked(_process);

vi.mock('./init/index.ts');
vi.mock('./process/index.ts');
vi.mock('./result.ts');
vi.mock('./error.ts');

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
  });
});
