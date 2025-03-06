import type { RenovateConfig } from '../../../../test/util';
import { logger, mocked, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as _secrets from '../../../config/secrets';
import * as _onboarding from '../onboarding/branch';
import * as _apis from './apis';
import * as _config from './config';
import * as _merge from './merge';
import { initRepo } from '.';

vi.mock('../../../util/git');
vi.mock('../onboarding/branch');
vi.mock('../configured');
vi.mock('../init/apis');
vi.mock('../init/config');
vi.mock('../init/merge');
vi.mock('../../../config/secrets');
vi.mock('../../../modules/platform', () => ({
  platform: { initRepo: vi.fn() },
  getPlatformList: vi.fn(),
}));

const apis = mocked(_apis);
const config = mocked(_config);
const merge = mocked(_merge);
const onboarding = mocked(_onboarding);
const secrets = mocked(_secrets);

describe('workers/repository/init/index', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '', cacheDir: '' });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('initRepo', () => {
    it('runs', async () => {
      apis.initApis.mockResolvedValue(partial<_apis.WorkerPlatformConfig>());
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.getRepoConfig.mockResolvedValueOnce({ mode: 'silent' });
      merge.mergeRenovateConfig.mockResolvedValueOnce({});
      secrets.applySecretsToConfig.mockReturnValueOnce(
        partial<RenovateConfig>(),
      );
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toEqual({});
    });

    it('warns on unsupported options', async () => {
      apis.initApis.mockResolvedValue(partial<_apis.WorkerPlatformConfig>());
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.getRepoConfig.mockResolvedValueOnce({
        filterUnavailableUsers: true,
        expandCodeOwnersGroups: true,
      });
      merge.mergeRenovateConfig.mockResolvedValueOnce({});
      secrets.applySecretsToConfig.mockReturnValueOnce(
        partial<RenovateConfig>(),
      );
      await initRepo({});
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { platform: undefined },
        "Configuration option 'filterUnavailableUsers' is not supported on the current platform.",
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { platform: undefined },
        "Configuration option 'expandCodeOwnersGroups' is not supported on the current platform.",
      );
    });
  });
});
