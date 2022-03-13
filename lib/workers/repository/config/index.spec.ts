import { logger, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as _secrets from '../../../config/secrets';
import * as _onboarding from '../update/onboarding/branch';
import * as _apis from './apis';
import * as _config from './config';
import * as _merge from './merge';
import { initRepo } from '.';

jest.mock('../../../config/secrets');
jest.mock('../../../util/git');
jest.mock('../configured');
jest.mock('../update/onboarding/branch');
jest.mock('./apis');
jest.mock('./config');
jest.mock('./merge');
jest.mock('./semantic');

const apis = mocked(_apis);
const config = mocked(_config);
const merge = mocked(_merge);
const onboarding = mocked(_onboarding);
const secrets = mocked(_secrets);

describe('workers/repository/config/index', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '', cacheDir: '' });
  });
  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('initRepo', () => {
    it('runs', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.getRepoConfig.mockResolvedValueOnce({});
      merge.mergeRenovateConfig.mockResolvedValueOnce({});
      secrets.applySecretsToConfig.mockReturnValueOnce({} as never);
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toEqual({});
    });
    it('warns on unsupported options', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.getRepoConfig.mockResolvedValueOnce({
        filterUnavailableUsers: true,
      });
      merge.mergeRenovateConfig.mockResolvedValueOnce({});
      secrets.applySecretsToConfig.mockReturnValueOnce({} as never);
      await initRepo({});
      expect(logger.logger.warn).toHaveBeenCalledWith(
        "Configuration option 'filterUnavailableUsers' is not supported on the current platform 'undefined'."
      );
    });
  });
});
