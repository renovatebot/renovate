import { mock } from 'jest-mock-extended';

import { RenovateConfig, getConfig, mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import * as _process from './process';
import { ExtractResult } from './process/extract-update';
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
      setGlobalConfig({ localDir: '' });
    });
    it('runs', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
