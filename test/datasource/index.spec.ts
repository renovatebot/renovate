import {
  supportsDigests,
  getPkgReleases,
  getDigest,
} from '../../lib/datasource';
import * as _npm from '../../lib/datasource/npm';

jest.mock('../../lib/datasource/docker');
jest.mock('../../lib/datasource/npm');

const npm: any = _npm;

describe('datasource/index', () => {
  it('returns if digests are supported', async () => {
    expect(await supportsDigests({ datasource: 'github' })).toBe(true);
  });
  it('returns null for no datasource', async () => {
    expect(
      await getPkgReleases({
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns null for unknown datasource', async () => {
    expect(
      await getPkgReleases({
        datasource: 'gitbucket',
        depName: 'some/dep',
      })
    ).toBeNull();
  });
  it('returns getDigest', async () => {
    expect(
      await getDigest({
        datasource: 'docker',
        depName: 'docker/node',
      })
    ).toBeUndefined();
  });
  it('adds changelogUrl', async () => {
    npm.getPkgReleases.mockReturnValue({});
    const res = await getPkgReleases({
      datasource: 'npm',
      depName: 'react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npm.getPkgReleases.mockReturnValue({});
    const res = await getPkgReleases({
      datasource: 'npm',
      depName: 'node',
    });
    expect(res).toMatchSnapshot();
    expect(res.sourceUrl).toBeDefined();
  });
  it('trims sourceUrl', async () => {
    npm.getPkgReleases.mockReturnValue({
      sourceUrl: ' https://abc.com',
    });
    const res = await getPkgReleases({
      datasource: 'npm',
      depName: 'abc',
    });
    expect(res.sourceUrl).toEqual('https://abc.com');
  });
  it('massages sourceUrl', async () => {
    npm.getPkgReleases.mockReturnValue({
      sourceUrl: 'scm:git@github.com:Jasig/cas.git',
    });
    const res = await getPkgReleases({
      datasource: 'npm',
      depName: 'cas',
    });
    expect(res.sourceUrl).toEqual('https://github.com/Jasig/cas');
  });
});
