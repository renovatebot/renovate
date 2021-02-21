import { platform } from '../../../../test/util';
import { RenovateConfig } from '../../../config';
import { getConfig } from '../../../config/defaults';

import { getPrBody } from '.';

describe('workers/pr/body for platform %s', () => {
  let config: RenovateConfig;
  beforeEach(() => {
    jest.resetAllMocks();
    config = getConfig();
    platform.getPrBody = jest.fn((input) => input);
  });
  it('generate the markdown body', async () => {
    const branchName = 'test/markdown';
    const prBody = await getPrBody({
      ...config,
      branchName,
      upgrades: [
        {
          branchName,
          depType: 'dependencies',
          updateType: 'patch',
          depName: '@scope/package',
          displayFrom: '^10.1.1',
          displayTo: '^10.1.2',
        },
      ],
    });
    expect(prBody).toMatchSnapshot();
  });
});
