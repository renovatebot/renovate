import os from 'node:os';
import { any, mockDeep } from 'jest-mock-extended';
import upath from 'upath';
import { mockedExtended } from '../../../test/util';
import * as exec_ from '../exec';
import { configSigningKey, writePrivateKey } from './private-key';
import { setPrivateKey } from '.';

jest.mock('fs-extra', () =>
  jest
    .requireActual<
      typeof import('../../../test/fixtures')
    >('../../../test/fixtures')
    .fsExtra(),
);
jest.mock('../exec', () => mockDeep());

const exec = mockedExtended(exec_);

describe('util/git/private-key', () => {
  describe('writePrivateKey()', () => {
    it('returns if no private key', async () => {
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });

    it('throws error if failing', async () => {
      setPrivateKey('some-key');
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(
          `gpg --import ${upath.join(os.tmpdir() + '/git-private-gpg.key')}`,
        )
        .mockRejectedValueOnce({
          stderr: `something wrong`,
          stdout: '',
        });
      await expect(writePrivateKey()).rejects.toThrow();
    });

    it('imports the private key', async () => {
      const publicKey = 'BADC0FFEE';
      const repoDir = '/tmp/some-repo';
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(
          `gpg --import ${upath.join(os.tmpdir() + '/git-private-gpg.key')}`,
        )
        .mockResolvedValueOnce({
          stderr: `gpg: key ${publicKey}: secret key imported\nfoo\n`,
          stdout: '',
        });
      setPrivateKey('some-key');
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();
      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${publicKey}`,
        { cwd: repoDir },
      );
      expect(exec.exec).toHaveBeenCalledWith('git config commit.gpgsign true', {
        cwd: repoDir,
      });
    });

    it('does not import the key again', async () => {
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });
  });
});
