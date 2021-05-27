import { getName, logger, mocked } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import * as _secrets from '../../../config/secrets';
import * as _onboarding from '../onboarding/branch';
import * as _apis from './apis';
import * as _config from './config';
import * as _merge from './merge';
import { initRepo } from '.';

jest.mock('../../../util/git');
jest.mock('../onboarding/branch');
jest.mock('../configured');
jest.mock('../init/apis');
jest.mock('../init/config');
jest.mock('../init/merge');
jest.mock('../../../config/secrets');
jest.mock('../init/semantic');

const apis = mocked(_apis);
const config = mocked(_config);
const merge = mocked(_merge);
const onboarding = mocked(_onboarding);
const secrets = mocked(_secrets);

describe(getName(), () => {
  beforeEach(() => {
    setAdminConfig({ localDir: '', cacheDir: '' });
  });
  afterEach(() => {
    setAdminConfig();
  });

  describe('initRepo', () => {
    it('runs', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.getRepoConfig.mockResolvedValueOnce({});
      merge.mergeRenovateConfig.mockResolvedValueOnce({});
      secrets.applySecretsToConfig.mockReturnValueOnce({} as never);
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toMatchSnapshot();
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
