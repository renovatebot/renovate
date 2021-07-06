import { exec as _exec } from 'child_process';
import { getName } from '../../../../test/util';
import { volumeCreate, volumePrune } from './volume';

const exec: jest.Mock<typeof _exec> = _exec as any;

jest.mock('child_process');

describe(getName(), () => {
  let dockerCommand: string;

  beforeEach(() => {
    jest.resetAllMocks();
    exec.mockImplementation((cmd, _opts, callback) => {
      dockerCommand = cmd;
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
  });

  describe('volumeCreate', () => {
    it('creates new volume', async () => {
      await volumeCreate('vol1', { foo: 'foo', bar: 'bar' });
      expect(dockerCommand).toBe(
        'docker volume create --label foo=foo --label bar=bar vol1'
      );
    });
  });

  describe('volumePrune', () => {
    it('prunes volumes', async () => {
      await volumePrune({ foo: 'foo', bar: 'bar' });
      expect(dockerCommand).toBe(
        'docker volume prune --force --filter label=foo=foo --filter label=bar=bar'
      );
    });
  });
});
