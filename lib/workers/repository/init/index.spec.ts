import { GlobalConfig } from '../../../config/global.ts';
import * as _secrets from '../../../config/secrets.ts';
import * as _onboarding from '../onboarding/branch/index.ts';
import * as _apis from './apis.ts';
import * as _config from './config.ts';
import { initRepo } from './index.ts';
import * as _merge from './merge.ts';
import { logger, partial } from '~test/util.ts';
import type { RenovateConfig } from '~test/util.ts';

vi.mock('../onboarding/branch/index.ts');
vi.mock('../configured.ts');
vi.mock('../init/apis.ts');
vi.mock('../init/config.ts');
vi.mock('../init/merge.ts');
vi.mock('../../../config/secrets.ts');
vi.mock('../../../config/variables.ts');
vi.mock('../../../modules/platform/index.ts', () => ({
  platform: { initRepo: vi.fn() },
  getPlatformList: vi.fn(),
}));
vi.unmock('../../../util/mutex');

const apis = vi.mocked(_apis);
const config = vi.mocked(_config);
const merge = vi.mocked(_merge);
const onboarding = vi.mocked(_onboarding);
const secrets = vi.mocked(_secrets);

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
      secrets.applySecretsAndVariablesToConfig.mockReturnValueOnce(
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
      secrets.applySecretsAndVariablesToConfig.mockReturnValueOnce(
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
