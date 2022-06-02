import { mock } from 'jest-mock-extended';

import { RenovateConfig, getConfig, mocked } from '../../../test/util';
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
    });

    it('runs', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      expect(res).toBeUndefined();
    });

    it('shows endpoint', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository({
        ...config,
        endpoint: 'https://github.com',
      });
      expect(GlobalConfig.get().endpoint).toBe('https://github.com');
      expect(res).toBeUndefined();
    });
  });
});
