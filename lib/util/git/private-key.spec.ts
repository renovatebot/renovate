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
import { logger, mockedExtended } from '~test/util';

vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures')>('~test/fixtures')
  ).fsExtra(),
);
vi.mock('../exec', () => ({ exec: mockFn() }));

const exec = mockedExtended(exec_);

describe('util/git/private-key', () => {
  const processExitSpy = vi.spyOn(process, 'exit');

  describe('writePrivateKey()', () => {
    beforeEach(() => {
      Fixtures.reset();
      exec.exec.mockReset();
    });

    it('returns if no private key', async () => {
      setPrivateKey(undefined, undefined);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey('/tmp/some-repo')).resolves.not.toThrow();
    });

    it('throws error if failing', async () => {
      setPrivateKey('some-key', undefined);
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
      setPrivateKey('some-key', undefined);
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

    it('throws error if SSH key passphrase decryption fails', async () => {
      const privateKeyFile = upath.join(os.tmpdir() + '/git-private-ssh.key');
      const passphrase = 'test-passphrase';
      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(
          `ssh-keygen -p -f ${privateKeyFile} -P "${passphrase}" -N ""`,
        )
        .mockRejectedValueOnce({
          stderr: `Load key "${privateKeyFile}": incorrect passphrase supplied to decrypt private key`,
          stdout: '',
        });
      setPrivateKey(
        `\
-----BEGIN OPENSSH PRIVATE KEY-----
some-private-key with-passphrase
some-private-key with-passphrase
-----END OPENSSH PRIVATE KEY-----
`,
        passphrase,
      );
      await expect(writePrivateKey()).rejects.toThrow();
    });

    it('imports SSH key with passphrase successfully', async () => {
      const privateKey = `\
-----BEGIN OPENSSH PRIVATE KEY-----
some-private-key with-passphrase
some-private-key with-passphrase
-----END OPENSSH PRIVATE KEY-----
`;
      const privateKeyFile = upath.join(os.tmpdir() + '/git-private-ssh.key');
      const publicKey = 'some-public-key';
      const passphrase = 'test-passphrase';
      const repoDir = '/tmp/some-repo';

      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(
          `ssh-keygen -p -f ${privateKeyFile} -P "${passphrase}" -N ""`,
        )
        .mockResolvedValueOnce({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(`ssh-keygen -y -f ${privateKeyFile}`)
        .mockResolvedValue({
          stderr: '',
          stdout: publicKey,
        });

      setPrivateKey(privateKey, passphrase);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();

      expect(exec.exec).toHaveBeenCalledWith(
        `ssh-keygen -p -f ${privateKeyFile} -P "${passphrase}" -N ""`,
      );
      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${privateKeyFile}`,
        { cwd: repoDir },
      );
    });

    it('warns about GPG key passphrase being ignored', () => {
      setPrivateKey('some-gpg-key', 'test-passphrase');

      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Passphrase is not yet supported for GPG keys, it will be ignored',
      );
    });

    it('accepts SSH key constructor with passphrase', () => {
      const privateKey = `\
-----BEGIN OPENSSH PRIVATE KEY-----
some-private-key with-passphrase
some-private-key with-passphrase
-----END OPENSSH PRIVATE KEY-----
`;
      const passphrase = 'test-passphrase';

      expect(() => setPrivateKey(privateKey, passphrase)).not.toThrow();
    });

    it('imports the private SSH key without passphrase', async () => {
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
        .calledWith(`ssh-keygen -y -f ${privateKeyFile}`)
        .mockResolvedValue({
          stderr: '',
          stdout: publicKey,
        });
      setPrivateKey(privateKey, undefined);
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

      expect(fs.existsSync(privateKeyFile)).toBeTrue();
      expect(fs.existsSync(publicKeyFile)).toBeTrue();

      processExitSpy.mockImplementationOnce(() => undefined as never);
    });

    it('handles SSH key with process.exit spy', async () => {
      const privateKey = `\
-----BEGIN OPENSSH PRIVATE KEY-----
some-private-key
some-private-key
-----END OPENSSH PRIVATE KEY-----
`;
      const privateKeyFile = upath.join(os.tmpdir() + '/git-private-ssh.key');
      const publicKey = 'some-public-key';

      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(`ssh-keygen -y -f ${privateKeyFile}`)
        .mockResolvedValue({
          stderr: '',
          stdout: publicKey,
        });

      processExitSpy.mockImplementationOnce(() => undefined as never);

      setPrivateKey(privateKey, undefined);
      await expect(writePrivateKey()).resolves.not.toThrow();

      expect(fs.existsSync(privateKeyFile)).toBeTrue();
    });
  });
});
