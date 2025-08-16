import os from 'node:os';
import { codeBlock } from 'common-tags';
import fs from 'fs-extra';
import upath from 'upath';
import { any, mockFn } from 'vitest-mock-extended';
import * as exec_ from '../exec';
import * as sanitize_ from '../sanitize';
import { toBase64 } from '../string';
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
vi.mock('../sanitize', () => ({ addSecretForSanitizing: mockFn() }));

const exec = mockedExtended(exec_);
const sanitize = mockedExtended(sanitize_);

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

  describe('base64 key encoding', () => {
    beforeEach(() => {
      Fixtures.reset();
      exec.exec.mockReset();
      logger.logger.warn.mockReset();
      sanitize.addSecretForSanitizing.mockReset();
    });

    it('decodes base64-encoded GPG key', async () => {
      const gpgKey = 'some-gpg-key-content';
      const base64GpgKey = toBase64(gpgKey);
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

      setPrivateKey(base64GpgKey, undefined);
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

    it('decodes base64-encoded SSH key (treated as GPG due to format detection)', async () => {
      const sshKey = codeBlock`
        -----BEGIN OPENSSH PRIVATE KEY-----
        some-private-key
        some-private-key
        -----END OPENSSH PRIVATE KEY-----
      `;
      const base64SshKey = toBase64(sshKey);
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

      setPrivateKey(base64SshKey, undefined);
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

    it('handles non-base64 encoded key unchanged', async () => {
      const plainKey = 'some-plain-text-key';
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

      setPrivateKey(plainKey, undefined);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();

      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${publicKey}`,
        { cwd: repoDir },
      );
    });

    it('handles invalid base64 that does not round-trip', async () => {
      const invalidBase64 = 'not-really-base64-but-might-partially-decode';
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

      setPrivateKey(invalidBase64, undefined);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();

      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${publicKey}`,
        { cwd: repoDir },
      );
    });

    it('decodes base64-encoded SSH key with passphrase (treated as GPG)', async () => {
      const sshKey = codeBlock`
        -----BEGIN OPENSSH PRIVATE KEY-----
        some-private-key with-passphrase
        some-private-key with-passphrase
        -----END OPENSSH PRIVATE KEY-----
      `;
      const base64SshKey = toBase64(sshKey);
      const publicKey = 'BADC0FFEE';
      const passphrase = 'test-passphrase';
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

      setPrivateKey(base64SshKey, passphrase);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();

      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${publicKey}`,
        { cwd: repoDir },
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Passphrase is not yet supported for GPG keys, it will be ignored',
      );
    });

    it('properly handles actual SSH key format with base64 content', async () => {
      const base64Content = toBase64('actual-ssh-key-data');
      const sshKeyWithBase64 = codeBlock`
        -----BEGIN OPENSSH PRIVATE KEY-----
        ${base64Content}
        -----END OPENSSH PRIVATE KEY-----
      `;
      const privateKeyFile = upath.join(os.tmpdir() + '/git-private-ssh.key');
      const publicKey = 'some-public-key';
      const repoDir = '/tmp/some-repo';

      exec.exec.calledWith(any()).mockResolvedValue({ stdout: '', stderr: '' });
      exec.exec
        .calledWith(`ssh-keygen -y -f ${privateKeyFile}`)
        .mockResolvedValue({
          stderr: '',
          stdout: publicKey,
        });

      setPrivateKey(sshKeyWithBase64, undefined);
      await expect(writePrivateKey()).resolves.not.toThrow();
      await expect(configSigningKey(repoDir)).resolves.not.toThrow();

      expect(exec.exec).toHaveBeenCalledWith(
        `git config user.signingkey ${privateKeyFile}`,
        { cwd: repoDir },
      );
      expect(exec.exec).toHaveBeenCalledWith('git config gpg.format ssh', {
        cwd: repoDir,
      });

      const savedKeyContent = (await fs.readFile(privateKeyFile)).toString();
      expect(savedKeyContent).toBe(sshKeyWithBase64 + '\n');
    });

    it('sanitizes both base64 and decoded keys for secret protection', () => {
      const originalKey = 'some-secret-key-content';
      const base64Key = toBase64(originalKey);

      setPrivateKey(base64Key, undefined);

      expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith(
        base64Key,
        'global',
      );
      expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith(
        originalKey,
        'global',
      );
    });

    it('sanitizes passphrase for base64 keys', () => {
      const originalKey = 'some-secret-key-content';
      const base64Key = toBase64(originalKey);
      const passphrase = 'secret-passphrase';

      setPrivateKey(base64Key, passphrase);

      expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith(
        base64Key,
        'global',
      );
      expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith(
        originalKey,
        'global',
      );
      expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith(
        passphrase,
        'global',
      );
    });
  });
});
