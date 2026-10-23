describe('util/s3.envvars', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RENOVATE_S3_AWS_ACCESS_KEY_ID', undefined);
    vi.stubEnv('RENOVATE_S3_AWS_SECRET_ACCESS_KEY', undefined);
    vi.stubEnv('RENOVATE_S3_AWS_REGION', undefined);
  });

  it('uses RENOVATE_S3_AWS_ACCESS_KEY_ID and RENOVATE_S3_AWS_SECRET_ACCESS_KEY if set', async () => {
    vi.stubEnv('RENOVATE_S3_AWS_ACCESS_KEY_ID', 'test-key');
    vi.stubEnv('RENOVATE_S3_AWS_SECRET_ACCESS_KEY', 'test-secret');
    const { getS3Client } = await import('./s3.ts');

    const client = getS3Client();

    await expect(client.config.credentials()).resolves.toMatchObject({
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
  });

  it('uses RENOVATE_S3_AWS_REGION if set', async () => {
    vi.stubEnv('RENOVATE_S3_AWS_REGION', 'us-west-2');
    const { getS3Client } = await import('./s3.ts');

    const client = getS3Client();

    await expect(client.config.region()).resolves.toBe('us-west-2');
  });

  it('prefers host rule credentials over the env credentials', async () => {
    vi.stubEnv('RENOVATE_S3_AWS_ACCESS_KEY_ID', 'test-key');
    vi.stubEnv('RENOVATE_S3_AWS_SECRET_ACCESS_KEY', 'test-secret');
    const { getS3Client } = await import('./s3.ts');
    const credentials = {
      accessKeyId: 'host-rule-key',
      secretAccessKey: 'host-rule-secret',
    };

    const client = getS3Client(undefined, undefined, credentials);

    await expect(client.config.credentials()).resolves.toMatchObject(
      credentials,
    );
  });
});
