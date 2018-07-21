const datasource = require('../../lib/datasource');

jest.mock('../../lib/datasource/docker');

describe('datasource/index', () => {
  it('returns null for invalid purl', async () => {
    expect(await datasource.getDependency('pkggithub/some/dep')).toBeNull();
  });
  it('returns getDigest', async () => {
    expect(
      await datasource.getDigest({ purl: 'pkg:docker/node' })
    ).toBeUndefined();
  });
});
