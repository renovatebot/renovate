import { mock } from 'jest-mock-extended';

import { renovateRepository } from '.';
import * as _process from './process';
import { RenovateConfig, getConfig, mocked } from '../../../test/util';
import { ExtractResult } from './process/extract-update';

const process = mocked(_process);

jest.mock('./init');
jest.mock('./process');
jest.mock('./result');
jest.mock('./error');

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = getConfig();
    });
    it('runs', async () => {
      process.processRepo.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      expect(res).toMatchSnapshot();
    });
  });
});
