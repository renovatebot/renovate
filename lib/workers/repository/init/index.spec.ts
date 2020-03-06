import * as _base from './base';
import * as _apis from './apis';
import { initRepo } from '.';
import { mocked } from '../../../../test/util';

jest.mock('../../../workers/repository/onboarding/branch');
jest.mock('../../../workers/repository/configured');
jest.mock('../../../workers/repository/init/apis');
jest.mock('../../../workers/repository/init/base');
jest.mock('../../../workers/repository/init/config');
jest.mock('../../../workers/repository/init/semantic');

const base = mocked(_base);
const apis = mocked(_apis);

describe('workers/repository/init', () => {
  describe('initRepo', () => {
    it('runs', async () => {
      base.checkBaseBranch.mockResolvedValue({});
      apis.initApis.mockResolvedValue({} as never);
      await initRepo({});
    });
  });
});
