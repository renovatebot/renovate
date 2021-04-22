import { mock } from 'jest-mock-extended';

import {
  RenovateConfig,
  getConfig,
  mocked,
  testName,
} from '../../../test/util';
import * as _process from './process';
import { ExtractResult } from './process/extract-update';
import { renovateRepository } from '.';

const process = mocked(_process);

jest.mock('./init');
jest.mock('./process');
jest.mock('./result');
jest.mock('./error');

describe(testName(), () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = getConfig();
    });
    it('runs', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      expect(res).toMatchSnapshot();
    });
  });
});
