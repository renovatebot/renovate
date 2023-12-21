import { mocked } from '../../../test/util';
import * as exec_ from '../exec';
import { configSigningKey, writePrivateKey } from './private-key';
import { setPrivateKey } from '.';

jest.mock('fs-extra', () =>
  jest
    .requireActual<typeof import('../../../test/fixtures')>(
      '../../../test/fixtures',
    )
    .fsExtra(),
);
jest.mock('../exec');

const exec = mocked(exec_);

describe('util/git/private-key', () => {
  describe('writePrivateKey()', () => {
    it('returns if no private key', async () => {
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });

    it('throws error if failing', async () => {
      setPrivateKey('some-key');
      exec.exec.mockRejectedValueOnce({
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
