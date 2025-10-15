import { mock } from 'vitest-mock-extended';
import { getConfig } from '../../config/defaults';
import * as _process from './process';
import type { ExtractResult } from './process/extract-update';
import { renovateRepository } from '.';
import type { RenovateConfig } from '~test/util';

const process = vi.mocked(_process);

vi.mock('./init');
vi.mock('./process');
vi.mock('./result');
vi.mock('./error');

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
