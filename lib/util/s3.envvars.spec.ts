import { getS3Client } from './s3';

describe('util/s3.envvars', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.RENOVATE_S3_AWS_ACCESS_KEY_ID;
    delete process.env.RENOVATE_S3_AWS_SECRET_ACCESS_KEY;
    delete process.env.RENOVATE_S3_AWS_REGION;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('uses RENOVATE_S3_AWS_ACCESS_KEY_ID and RENOVATE_S3_AWS_SECRET_ACCESS_KEY if set', async () => {
    process.env.RENOVATE_S3_AWS_ACCESS_KEY_ID = 'test-key';
    process.env.RENOVATE_S3_AWS_SECRET_ACCESS_KEY = 'test-secret';
    const { getS3Client } = await import('./s3.js');
    const client = getS3Client();
    const creds = await client.config.credentials();
    expect(creds.accessKeyId).toBe('test-key');
    expect(creds.secretAccessKey).toBe('test-secret');
  });

  it('uses RENOVATE_S3_AWS_REGION if set', async () => {
    process.env.RENOVATE_S3_AWS_REGION = 'us-west-2';
    const client = getS3Client();
    const region =
      typeof client.config.region === 'function'
        ? await client.config.region()
        : client.config.region;
    expect(region).toBe('us-west-2');
  });

  it('falls back to AWS SDK default provider chain if S3-specific vars are not set', async () => {
    const { getS3Client } = await import('./s3.js');
    const client = getS3Client();
    // The credentials property should be a function (provider), not static creds
    expect(typeof client.config.credentials).toBe('function');
  });
});
