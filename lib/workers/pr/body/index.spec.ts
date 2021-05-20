import { getName, platform } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import type { RenovateConfig } from '../../../config/types';
import { getPrBody } from '.';

jest.mock('./config-description', () => ({
  getPrConfigDescription: jest.fn(() => ''),
}));
jest.mock('./controls', () => ({
  getControls: jest.fn(() => ''),
}));

describe(getName(), () => {
  let config: RenovateConfig;
  beforeEach(() => {
    config = getConfig();
    platform.massageMarkdown = jest.fn((input) => input);
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
