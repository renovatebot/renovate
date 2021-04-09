import { getName, mocked } from '../../../test/util';
import * as exec_ from '../exec';
import {
  configSigningKey,
  setPrivateKey,
  writePrivateKey,
} from './private-key';

jest.mock('fs-extra');
jest.mock('../exec');

const exec = mocked(exec_);

describe(getName(__filename), () => {
  describe('writePrivateKey()', () => {
    it('returns if no private key', async () => {
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });
    it('throws error if failing', async () => {
      setPrivateKey('some-key');
      exec.exec.mockResolvedValueOnce({
        stderr: `something wrong`,
        stdout: '',
      });
      await expect(writePrivateKey()).rejects.toThrow();
    });
    it('imports the private key', async () => {
      setPrivateKey('some-key');
      exec.exec.mockResolvedValueOnce({
        stderr: `gpg: key BADC0FFEE: secret key imported\nfoo\n`,
        stdout: '',
      });
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });
    it('does not import the key again', async () => {
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });
  });
});
