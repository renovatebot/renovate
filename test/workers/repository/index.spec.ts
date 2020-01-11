import { mock } from 'jest-mock-extended';

import { renovateRepository } from '../../../lib/workers/repository/index';
import * as _process from '../../../lib/workers/repository/process';
import { mocked, RenovateConfig, getConfig } from '../../util';
import { ExtractAndUpdateResult } from '../../../lib/workers/repository/process/extract-update';

const process = mocked(_process);

jest.mock('../../../lib/workers/repository/init');
jest.mock('../../../lib/workers/repository/process');
jest.mock('../../../lib/workers/repository/result');
jest.mock('../../../lib/workers/repository/error');

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = getConfig;
    });
    it('runs', async () => {
      process.processRepo.mockResolvedValue(mock<ExtractAndUpdateResult>());
      const res = await renovateRepository(config);
      expect(res).toMatchSnapshot();
    });
  });
});
