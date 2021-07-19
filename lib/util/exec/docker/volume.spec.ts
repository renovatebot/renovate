import { exec, mockExecAll } from '../../../../test/exec-util';
import { getName } from '../../../../test/util';
import { volumeCreate, volumePrune } from './volume';

jest.mock('child_process');

describe(getName(), () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('volumePrune', () => {
    it('prunes volumes', async () => {
      const execSnapshots = mockExecAll(exec);
      await volumePrune({ foo: 'foo', bar: 'bar' });
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker volume prune --force --filter label=foo=foo --filter label=bar=bar',
        },
      ]);
    });
  });

  describe('volumeCreate', () => {
    it('creates new volume', async () => {
      const execSnapshots = mockExecAll(exec);
      await volumeCreate('vol1', { foo: 'foo', bar: 'bar' });
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker volume create --label foo=foo --label bar=bar vol1' },
      ]);
    });
  });
});
