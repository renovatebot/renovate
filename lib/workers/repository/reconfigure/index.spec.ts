import type { RenovateConfig } from '../../../../test/util';
import { logger, mocked, scm } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as _validate from './validate';
import { checkReconfigureBranch } from '.';

jest.mock('./validate');

const validate = mocked(_validate);

describe('workers/repository/reconfigure/index', () => {
  const config: RenovateConfig = {
    branchPrefix: 'prefix/',
    baseBranch: 'base',
  };

  beforeEach(() => {
    GlobalConfig.reset();
    scm.branchExists.mockResolvedValue(true);
    validate.validateReconfigureBranch.mockResolvedValue(undefined);
  });

  it('no effect when running with platform=local', async () => {
    GlobalConfig.set({ platform: 'local' });
    await checkReconfigureBranch(config);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'Not attempting to reconfigure when running with local platform',
    );
  });

  it('no effect on repo with no reconfigure branch', async () => {
    scm.branchExists.mockResolvedValueOnce(false);
    await checkReconfigureBranch(config);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'No reconfigure branch found',
    );
  });

  it('validates reconfigure branch', async () => {
    await expect(checkReconfigureBranch(config)).toResolve();
  });
});
