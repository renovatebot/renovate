import { mock } from 'vitest-mock-extended';
import { getConfig } from '../../config/defaults';
import { GlobalConfig } from '../../config/global';
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
      GlobalConfig.set({ localDir: '' });
    });

    it('runs', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      expect(res).toBeUndefined();
    });
  });
});
