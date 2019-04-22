const datasource = require('../../lib/datasource');
const npmDatasource = require('../../lib/datasource/npm');

jest.mock('../../lib/datasource/docker');
jest.mock('../../lib/datasource/npm');

describe('datasource/index', () => {
  it('returns if digests are supported', async () => {
    expect(await datasource.supportsDigests({ datasource: 'github' })).toBe(
      true
    );
  });
  it('returns null for no datasource', async () => {
    expect(
      await datasource.getPkgReleases({
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns null for unknown datasource', async () => {
    expect(
      await datasource.getPkgReleases({
        datasource: 'gitbucket',
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns getDigest', async () => {
    expect(
      await datasource.getDigest({
        datasource: 'docker',
        depName: 'docker/node',
      })
    ).toBeUndefined();
  });
  it('adds changelogUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      datasource: 'npm',
      depName: 'react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      datasource: 'npm',
      depName: 'node',
    });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
  it('trims sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({
      sourceUrl: ' https://abc.com',
    });
    const res = await datasource.getPkgReleases({
      datasource: 'npm',
      depName: 'abc',
    });
    expect(res.sourceUrl).toEqual('https://abc.com');
  });
  it('massages sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({
      sourceUrl: 'scm:git@github.com:Jasig/cas.git',
    });
    const res = await datasource.getPkgReleases({
      datasource: 'npm',
      depName: 'cas',
    });
    expect(res.sourceUrl).toEqual('https://github.com/Jasig/cas');
  });
});
