import { mocked } from '../../../../test/util';
import * as _apis from './apis';
import * as _base from './base';
import * as _config from './config';
import { initRepo } from '.';

jest.mock('../../../workers/repository/onboarding/branch');
jest.mock('../../../workers/repository/configured');
jest.mock('../../../workers/repository/init/apis');
jest.mock('../../../workers/repository/init/base');
jest.mock('../../../workers/repository/init/config');
jest.mock('../../../workers/repository/init/semantic');

const base = mocked(_base);
const apis = mocked(_apis);
const config = mocked(_config);

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      base.checkBaseBranch.mockResolvedValue({});
      apis.initApis.mockResolvedValue({} as never);
      config.mergeRenovateConfig.mockResolvedValueOnce({});
      const renovateConfig = await initRepo({});
      expect(renovateConfig).toMatchSnapshot();
    });
  });
});
