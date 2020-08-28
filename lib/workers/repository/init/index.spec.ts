import { mocked } from '../../../../test/util';
import * as _secrets from '../../../config/secrets';
import * as _onboarding from '../onboarding/branch';
import * as _apis from './apis';
import * as _cache from './cache';
import * as _config from './config';
import { initRepo } from '.';

jest.mock('../../../util/git');
jest.mock('../onboarding/branch');
jest.mock('../configured');
jest.mock('../init/apis');
jest.mock('../init/config');
jest.mock('../../../config/secrets');
jest.mock('../init/semantic');
jest.mock('./cache');

const apis = mocked(_apis);
const cache = mocked(_cache);
const config = mocked(_config);
const onboarding = mocked(_onboarding);
const secrets = mocked(_secrets);

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.mergeRenovateConfig.mockResolvedValueOnce({});
      secrets.applySecretsToConfig.mockResolvedValueOnce({} as never);
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toMatchSnapshot();
    });
    it('uses cache', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      cache.getResolvedConfig.mockResolvedValueOnce({} as never);
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toMatchSnapshot();
    });
  });
});
