import { Readable } from 'node:stream';
import type { GetObjectCommandInput } from '@aws-sdk/client-s3';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import fs from 'fs-extra';
import * as tar from 'tar';
import { logger } from '../../logger/index.ts';
import { archiveGitDataToS3, restoreGitDataFromS3 } from './s3-persist.ts';

describe('util/git/s3-persist', () => {
  const s3Mock = mockClient(S3Client);
  const platform = 'github';
  const repository = 'org/repo';
  const s3Url = 's3://my-bucket/renovate-git/';

  let tmpDir: string;

  beforeEach(async () => {
    s3Mock.reset();
    tmpDir = await fs.mkdtemp('/tmp/s3-persist-test-');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  function expectedGetParams(): GetObjectCommandInput {
    return {
      Bucket: 'my-bucket',
      Key: 'renovate-git/github/org/repo/git-data.tar.gz',
    };
  }

  async function createValidArchive(sourceDir: string): Promise<Buffer> {
    const gitDir = `${sourceDir}/.git`;
    await fs.ensureDir(gitDir);
    await fs.writeFile(`${gitDir}/HEAD`, 'ref: refs/heads/main\n');
    await fs.writeFile(`${gitDir}/config`, '[core]\n');

    const pack = tar.create({ gzip: true, cwd: sourceDir }, ['.git']);
    const chunks: Buffer[] = [];
    for await (const chunk of pack) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  async function createCorruptArchive(sourceDir: string): Promise<Buffer> {
    await fs.ensureDir(`${sourceDir}/not-git`);
    await fs.writeFile(`${sourceDir}/not-git/file.txt`, 'data');

    const pack = tar.create({ gzip: true, cwd: sourceDir }, ['not-git']);
    const chunks: Buffer[] = [];
    for await (const chunk of pack) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  async function streamToBuffer(
    stream: NodeJS.ReadableStream,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  describe('restoreGitDataFromS3', () => {
    it('throws on invalid S3 URL', async () => {
      await expect(
        restoreGitDataFromS3(tmpDir, 'not-an-s3-url', platform, repository),
      ).rejects.toThrow('Invalid S3 URL: not-an-s3-url');
    });

    it('restores git data successfully', async () => {
      const archiveDir = await fs.mkdtemp('/tmp/s3-persist-archive-');
      const archive = await createValidArchive(archiveDir);
      await fs.remove(archiveDir);

      s3Mock
        .on(GetObjectCommand, expectedGetParams())
        .resolvesOnce({ Body: Readable.from([archive]) as never });

      const result = await restoreGitDataFromS3(
        tmpDir,
        s3Url,
        platform,
        repository,
      );

      expect(result).toBeTrue();
      expect(await fs.pathExists(`${tmpDir}/.git/HEAD`)).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        { key: 'renovate-git/github/org/repo/git-data.tar.gz' },
        'restoreGitDataFromS3() - success',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns false on first run (NoSuchKey)', async () => {
      const err = new Error('NoSuchKey');
      err.name = 'NoSuchKey';
      s3Mock.on(GetObjectCommand, expectedGetParams()).rejectsOnce(err);

      const result = await restoreGitDataFromS3(
        tmpDir,
        s3Url,
        platform,
        repository,
      );

      expect(result).toBeFalse();
      expect(logger.debug).toHaveBeenCalledWith(
        'restoreGitDataFromS3() - no archive found in S3',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns false on S3 error', async () => {
      const err = new Error('AccessDenied');
      s3Mock.on(GetObjectCommand, expectedGetParams()).rejectsOnce(err);

      const result = await restoreGitDataFromS3(
        tmpDir,
        s3Url,
        platform,
        repository,
      );

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        { err },
        'restoreGitDataFromS3() - failure',
      );
    });

    it('returns false and cleans up on corrupted archive', async () => {
      const archiveDir = await fs.mkdtemp('/tmp/s3-persist-archive-');
      const archive = await createCorruptArchive(archiveDir);
      await fs.remove(archiveDir);

      s3Mock
        .on(GetObjectCommand, expectedGetParams())
        .resolvesOnce({ Body: Readable.from([archive]) as never });

      const result = await restoreGitDataFromS3(
        tmpDir,
        s3Url,
        platform,
        repository,
      );

      expect(result).toBeFalse();
      expect(await fs.pathExists(`${tmpDir}/.git`)).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        { key: 'renovate-git/github/org/repo/git-data.tar.gz' },
        'restoreGitDataFromS3() - archive extracted but .git/HEAD not found, cleaning up',
      );
    });

    it('returns false on unexpected response type', async () => {
      s3Mock
        .on(GetObjectCommand, expectedGetParams())
        .resolvesOnce({ Body: undefined as never });

      const result = await restoreGitDataFromS3(
        tmpDir,
        s3Url,
        platform,
        repository,
      );

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        { returnType: 'undefined' },
        'restoreGitDataFromS3() - unexpected response type from S3',
      );
    });

    it('handles S3 URL without trailing slash', async () => {
      const archiveDir = await fs.mkdtemp('/tmp/s3-persist-archive-');
      const archive = await createValidArchive(archiveDir);
      await fs.remove(archiveDir);

      s3Mock.on(GetObjectCommand).resolvesOnce({
        Body: Readable.from([archive]) as never,
      });

      const result = await restoreGitDataFromS3(
        tmpDir,
        's3://my-bucket/renovate-git',
        platform,
        repository,
      );

      expect(result).toBeTrue();
      expect(logger.warn).toHaveBeenCalledWith(
        { pathname: 'renovate-git' },
        'getS3Key() - appending missing trailing slash to pathname',
      );
      const call = s3Mock.commandCalls(GetObjectCommand)[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'my-bucket',
        Key: 'renovate-git/github/org/repo/git-data.tar.gz',
      });
    });

    it('handles S3 URL with no prefix path', async () => {
      const archiveDir = await fs.mkdtemp('/tmp/s3-persist-archive-');
      const archive = await createValidArchive(archiveDir);
      await fs.remove(archiveDir);

      s3Mock.on(GetObjectCommand).resolvesOnce({
        Body: Readable.from([archive]) as never,
      });

      const result = await restoreGitDataFromS3(
        tmpDir,
        's3://my-bucket',
        platform,
        repository,
      );

      expect(result).toBeTrue();
      const call = s3Mock.commandCalls(GetObjectCommand)[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'my-bucket',
        Key: 'github/org/repo/git-data.tar.gz',
      });
    });

    it('handles nested repository paths', async () => {
      const archiveDir = await fs.mkdtemp('/tmp/s3-persist-archive-');
      const archive = await createValidArchive(archiveDir);
      await fs.remove(archiveDir);

      s3Mock.on(GetObjectCommand).resolvesOnce({
        Body: Readable.from([archive]) as never,
      });

      const result = await restoreGitDataFromS3(
        tmpDir,
        s3Url,
        'gitlab',
        'group/subgroup/repo',
      );

      expect(result).toBeTrue();
      const call = s3Mock.commandCalls(GetObjectCommand)[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'my-bucket',
        Key: 'renovate-git/gitlab/group/subgroup/repo/git-data.tar.gz',
      });
    });
  });

  describe('archiveGitDataToS3', () => {
    it('archives git data successfully', async () => {
      await fs.ensureDir(`${tmpDir}/.git`);
      await fs.writeFile(`${tmpDir}/.git/HEAD`, 'ref: refs/heads/main\n');

      s3Mock.on(PutObjectCommand).resolvesOnce({
        $metadata: { httpStatusCode: 200 },
      });

      await archiveGitDataToS3(tmpDir, s3Url, platform, repository);

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.Bucket).toBe('my-bucket');
      expect(calls[0].args[0].input.Key).toBe(
        'renovate-git/github/org/repo/git-data.tar.gz',
      );
      expect(calls[0].args[0].input.ContentType).toBe('application/gzip');
      expect(calls[0].args[0].input.Body).toBeInstanceOf(Readable);
      expect(logger.debug).toHaveBeenCalledWith(
        { key: 'renovate-git/github/org/repo/git-data.tar.gz' },
        'archiveGitDataToS3() - success',
      );
    });

    it('skips archive when .git does not exist', async () => {
      await archiveGitDataToS3(tmpDir, s3Url, platform, repository);

      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'archiveGitDataToS3() - no .git directory found, skipping',
      );
    });

    it('logs warning on S3 upload failure', async () => {
      await fs.ensureDir(`${tmpDir}/.git`);
      await fs.writeFile(`${tmpDir}/.git/HEAD`, 'ref: refs/heads/main\n');

      const err = new Error('Upload failed');
      s3Mock.on(PutObjectCommand).rejectsOnce(err);

      await archiveGitDataToS3(tmpDir, s3Url, platform, repository);

      expect(logger.warn).toHaveBeenCalledWith(
        { err },
        'archiveGitDataToS3() - failure',
      );
    });

    it('produces a valid archive that can be restored', async () => {
      await fs.ensureDir(`${tmpDir}/.git/refs`);
      await fs.writeFile(`${tmpDir}/.git/HEAD`, 'ref: refs/heads/main\n');
      await fs.writeFile(`${tmpDir}/.git/config`, '[core]\n');

      let uploadedBody: Buffer | undefined;
      s3Mock.on(PutObjectCommand).callsFake(async (input) => {
        uploadedBody = await streamToBuffer(
          input.Body as NodeJS.ReadableStream,
        );
        return { $metadata: { httpStatusCode: 200 } };
      });

      await archiveGitDataToS3(tmpDir, s3Url, platform, repository);
      expect(uploadedBody).toBeDefined();

      // Restore to a different directory
      const restoreDir = await fs.mkdtemp('/tmp/s3-persist-restore-');
      s3Mock.reset();
      s3Mock.on(GetObjectCommand).resolvesOnce({
        Body: Readable.from([uploadedBody!]) as never,
      });

      const result = await restoreGitDataFromS3(
        restoreDir,
        s3Url,
        platform,
        repository,
      );

      expect(result).toBeTrue();
      expect(await fs.readFile(`${restoreDir}/.git/HEAD`, 'utf8')).toBe(
        'ref: refs/heads/main\n',
      );
      expect(await fs.readFile(`${restoreDir}/.git/config`, 'utf8')).toBe(
        '[core]\n',
      );

      await fs.remove(restoreDir);
    });
  });
});
