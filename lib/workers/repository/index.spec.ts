import { mock } from 'jest-mock-extended';
import { RenovateConfig, mocked } from '../../../test/util';
import { getConfig } from '../../config/defaults';
import { GlobalConfig } from '../../config/global';
import * as _process from './process';
import type { ExtractResult } from './process/extract-update';
import { renovateRepository } from '.';

const process = mocked(_process);

jest.mock('./init');
jest.mock('./process');
jest.mock('./result');
jest.mock('./error');

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
