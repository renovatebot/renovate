import * as datasource from '../../lib/datasource';
import * as _npm from '../../lib/datasource/npm';
import * as _hostRules from '../../lib/util/host-rules';

jest.mock('../../lib/datasource/docker');
jest.mock('../../lib/datasource/npm');
jest.mock('../../lib/util/host-rules');

const npmDatasource: any = _npm;
const hostRules: any = _hostRules;

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
  it('test sourceUrl -> remove www. from fqdn', async () => {
    const url = 'https://www.github.com/abc/';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/');
  });
  it('test sourceUrl -> convert http:// to https for github.com', async () => {
    const url = 'http://github.com/abc/edf.git';
    hostRules.hosts.mockImplementationOnce(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/edf');
  });
  it('test sourceUrl -> convert http://www.github.com/abc/ -> https://github.com/abc/edf.git', async () => {
    const url = 'http://github.com/abc/edf.git';
    hostRules.hosts.mockImplementationOnce(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/edf');
  });
  it('test sourceUrl -> bogus url', async () => {
    const url = 'a';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual(null);
  });
  it('test sourceUrl -> non-github url', async () => {
    const url = 'http://gitlab.com/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('http://gitlab.com/abc/edf');
  });
  it('mock hosts array from host-rules -> https://', async () => {
    const url = 'http://github.com/abc/some.git';
    hostRules.hosts.mockImplementationOnce(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/some');
  });
  it('mock hosts array from host-rules -> git:', async () => {
    const url = 'git:github.com/abc/some.git';
    hostRules.hosts.mockImplementation(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/some');
  });
});
