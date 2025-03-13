import os from 'node:os';
import fs from 'fs-extra';
import upath from 'upath';
import { any, mockFn } from 'vitest-mock-extended';
import * as exec_ from '../exec';
import {
  configSigningKey,
  setPrivateKey,
  writePrivateKey,
} from './private-key';
import { Fixtures } from '~test/fixtures';
import { mockedExtended } from '~test/util';

vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures')>('~test/fixtures')
  ).fsExtra(),
);
vi.mock('../exec', () => ({ exec: mockFn() }));

const exec = mockedExtended(exec_);

describe('util/git/private-key', () => {
  describe('writePrivateKey()', () => {
    beforeEach(() => {
      Fixtures.reset();
      exec.exec.mockReset();
    });

    it('returns if no private key', async () => {
      setPrivateKey(undefined);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });

    it('throws error if failing', async () => {
      setPrivateKey('some-key');
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(
          `gpg --batch --no-tty --import ${upath.join(os.tmpdir() + '/git-private-gpg.key')}`,
        )
        .mockRejectedValueOnce({
          stderr: `something wrong`,
          stdout: '',
        });
      await expect(writePrivateKey()).rejects.toThrow();
    });

    it('imports the private GPG key', async () => {
      const publicKey = 'BADC0FFEE';
      const repoDir = '/tmp/some-repo';
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(
          `gpg --batch --no-tty --import ${upath.join(os.tmpdir() + '/git-private-gpg.key')}`,
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
      expect(exec.exec).toHaveBeenCalledWith('git config gpg.format openpgp', {
        cwd: repoDir,
      });
    });

    it('does not import the key again', async () => {
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });

    it('throws error if the private SSH key has a passphrase', async () => {
      const privateKeyFile = upath.join(os.tmpdir() + '/git-private-ssh.key');
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(`ssh-keygen -y -P "" -f ${privateKeyFile}`)
        .mockRejectedValueOnce({
          stderr: `Load key "${privateKeyFile}": incorrect passphrase supplied to decrypt private key`,
          stdout: '',
        });
      setPrivateKey(`\
-----BEGIN OPENSSH PRIVATE KEY-----
some-private-key with-passphrase
some-private-key with-passphrase
-----END OPENSSH PRIVATE KEY-----
`);
      await expect(writePrivateKey()).rejects.toThrow();
    });

    it('imports the private SSH key', async () => {
      const privateKey = `\
-----BEGIN OPENSSH PRIVATE KEY-----
some-private-key
some-private-key
-----END OPENSSH PRIVATE KEY-----
`;
      const privateKeyFile = upath.join(os.tmpdir() + '/git-private-ssh.key');
      const publicKeyFile = `${privateKeyFile}.pub`;
      const publicKey = 'some-public-key';
      const repoDir = '/tmp/some-repo';
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(`ssh-keygen -y -P "" -f ${privateKeyFile}`)
        .mockResolvedValue({
          stderr: '',
          stdout: publicKey,
        });
      setPrivateKey(privateKey);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();
      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${privateKeyFile}`,
        { cwd: repoDir },
      );
      const privateKeyFileMode = (await fs.stat(privateKeyFile)).mode;
      expect((privateKeyFileMode & 0o777).toString(8)).toBe('600');
      expect((await fs.readFile(privateKeyFile)).toString()).toEqual(
        privateKey,
      );
      expect((await fs.readFile(publicKeyFile)).toString()).toEqual(publicKey);
      expect(exec.exec).toHaveBeenCalledWith('git config commit.gpgsign true', {
        cwd: repoDir,
      });
      expect(exec.exec).toHaveBeenCalledWith('git config gpg.format ssh', {
        cwd: repoDir,
      });
      process.emit('exit', 0);
      expect(fs.existsSync(privateKeyFile)).toBeFalse();
      expect(fs.existsSync(publicKeyFile)).toBeFalse();
    });
  });
});
