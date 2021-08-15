import { mock } from 'jest-mock-extended';

import { RenovateConfig, getConfig, getName, mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import * as _execCacheId from '../../util/exec/cache-id';
import * as _process from './process';
import { ExtractResult } from './process/extract-update';
import { renovateRepository } from '.';

const process = mocked(_process);

jest.mock('./init');
jest.mock('./process');
jest.mock('./result');
jest.mock('./error');
jest.mock('../../util/exec/cache-id');

const execCacheId = mocked(_execCacheId);

describe(getName(), () => {
  describe('renovateRepository()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      execCacheId.getCachedTmpDirId.mockReturnValue('1234');
      setGlobalConfig({ localDir: '' });
      config = { ...getConfig(), localDir: '', cacheDir: '' };
    });
    it('runs', async () => {
      process.extractDependencies.mockResolvedValue(mock<ExtractResult>());
      const res = await renovateRepository(config);
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
