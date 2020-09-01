import { mocked } from '../../../../test/util';
import * as _onboarding from '../onboarding/branch';
import * as _apis from './apis';
import * as _config from './config';
import { initRepo } from '.';

jest.mock('../../../util/git');
jest.mock('../onboarding/branch');
jest.mock('../configured');
jest.mock('../init/apis');
jest.mock('../init/config');
jest.mock('../init/semantic');

const apis = mocked(_apis);
const config = mocked(_config);
const onboarding = mocked(_onboarding);

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      config.getRepoConfig.mockResolvedValueOnce({});
      config.mergeRenovateConfig.mockResolvedValueOnce({});
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toMatchSnapshot();
    });
  });
});
