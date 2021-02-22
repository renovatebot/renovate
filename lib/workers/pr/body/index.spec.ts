import { platform } from '../../../../test/util';
import { RenovateConfig } from '../../../config';
import { getConfig } from '../../../config/defaults';

import { getPrBody } from '.';

describe('workers/pr/body', () => {
  let config: RenovateConfig;
  beforeEach(() => {
    jest.resetAllMocks();
    config = getConfig();
    platform.getPrBody = jest.fn((input) => input);
  });
  it('generate the message markdown', async () => {
    const branchName = 'test/markdown';
    const prBody = await getPrBody({
      ...config,
      branchName,
      upgrades: [
        {
          branchName,
          depType: 'dependencies',
          updateType: 'patch',
          depName: '@scope/package-with-link',
          sourceUrl: 'http://scope.com/package-with-link',
          displayFrom: '^10.1.1',
          displayTo: '^10.1.2',
        },
        {
          branchName,
          depType: 'dependencies',
          updateType: 'patch',
          depName: '@scope/package-without-link',
          displayFrom: '^10.1.1',
          displayTo: '^10.1.2',
        },
      ],
    });
    expect(prBody).toMatchSnapshot();
  });
});
