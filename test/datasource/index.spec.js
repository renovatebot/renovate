const datasource = require('../../lib/datasource');
const npmDatasource = require('../../lib/datasource/npm');

jest.mock('../../lib/datasource/docker');
jest.mock('../../lib/datasource/npm');

describe('datasource/index', () => {
  it('returns if digests are supported', async () => {
    expect(await datasource.supportsDigests('pkg:github/some/dep')).toBe(true);
  });
  it('returns null for unknown datasource', async () => {
    expect(
      await datasource.getPkgReleases({ purl: 'pkg:gitbucket/some/dep' })
    ).toBeNull();
  });
  it('returns null for invalid purl', async () => {
    expect(
      await datasource.getPkgReleases({ purl: 'pkggithub/some/dep' })
    ).toBeNull();
  });
  it('returns getDigest', async () => {
    expect(
      await datasource.getDigest({ purl: 'pkg:docker/node' })
    ).toBeUndefined();
  });
  it('adds changelogUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      purl: 'pkg:npm/react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({ purl: 'pkg:npm/node' });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
});
