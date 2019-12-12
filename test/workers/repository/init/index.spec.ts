import * as _base from '../../../../lib/workers/repository/init/base';
import * as _apis from '../../../../lib/workers/repository/init/apis';
import { initRepo } from '../../../../lib/workers/repository/init';
import { mocked } from '../../../util';

jest.mock('../../../../lib/workers/repository/onboarding/branch');
jest.mock('../../../../lib/workers/repository/configured');
jest.mock('../../../../lib/workers/repository/init/apis');
jest.mock('../../../../lib/workers/repository/init/base');
jest.mock('../../../../lib/workers/repository/init/config');
jest.mock('../../../../lib/workers/repository/init/semantic');

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
