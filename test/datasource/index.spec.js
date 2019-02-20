const datasource = require('../../lib/datasource');
const npmDatasource = require('../../lib/datasource/npm');

jest.mock('../../lib/datasource/docker');
jest.mock('../../lib/datasource/npm');

describe('datasource/index', () => {
  it('returns null for invalid purl', async () => {
    expect(await datasource.getPkgReleases('pkggithub/some/dep')).toBeNull();
  });
  it('returns getDigest', async () => {
    expect(
      await datasource.getDigest({ purl: 'pkg:docker/node' })
    ).toBeUndefined();
  });
  it('adds changelogUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases('pkg:npm/react-native');
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases('pkg:npm/node');
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
});
