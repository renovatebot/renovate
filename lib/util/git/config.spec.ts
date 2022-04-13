import { mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import { simpleGitConfig } from './config';

jest.mock('../../config/global');
const globalConfig = mocked(GlobalConfig);

describe('util/git/config', () => {
  
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uses "close" events, ignores "exit" events from child processes', () => {
    globalConfig.get.mockReturnValue(10000);
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
      timeout: {
        block: 10000,
      },
    });
  });
});
