import { mocked } from '../../../../test/util';
import * as _onboarding from '../onboarding/branch';
import * as _apis from './apis';
import { initRepo } from '.';

jest.mock('../../../util/git');
jest.mock('../onboarding/branch');
jest.mock('../configured');
jest.mock('../init/apis');
jest.mock('../init/semantic');

const apis = mocked(_apis);
const onboarding = mocked(_onboarding);

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      apis.initApis.mockResolvedValue({} as never);
      onboarding.checkOnboardingBranch.mockResolvedValueOnce({});
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toMatchSnapshot();
    });
  });
});
