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
    npmDatasource.getPkgReleases.mockReturnValueOnce({});
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
    npmDatasource.getPkgReleases.mockReturnValueOnce({
      datasource: 'npm',
      depName: 'abc',
      sourceUrl: 'https://gitlab.com/some/dep/',
    });
    const res = await datasource.getPkgReleases({
      datasource: 'npm',
      depName: 'abc',
    });
    expect(res.sourceUrl).toEqual('https://gitlab.com/some/dep');
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
    const url = 'https://www.github.com/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/edf');
  });
  it('test sourceUrl -> convert ssh:// to https for hosted gitlab', async () => {
    const url = 'https://somehostedgitlab.com/abc/edf.git';
    hostRules.hosts.mockImplementationOnce(() => {
      return ['somehostedgitlab.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://somehostedgitlab.com/abc/edf');
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
    const url = 'https://gitlab.com/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://gitlab.com/abc/edf');
  });
  it('mock hosts array from host-rules', async () => {
    const url = 'https://gitlab.com/abc/some.git';
    hostRules.hosts.mockImplementationOnce(() => {
      return ['gitlab.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://gitlab.com/abc/some');
  });
  it('mock hosts array from host-rules -> git:', async () => {
    const url = 'git:github.com/abc/some.git';
    hostRules.hosts.mockImplementation(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/abc/some');
  });
  it('handle trailing slashes.', async () => {
    const url = ' http://www.github.com/some/repo/ ';
    hostRules.hosts.mockImplementation(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/some/repo');
  });
  it('test scp shorthand syntax.', async () => {
    const url = 'git@github.com:some/repo.git';
    hostRules.hosts.mockImplementation(() => {
      return ['github.com'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://github.com/some/repo');
  });
  it('move bad url into homepage', async () => {
    npmDatasource.getPkgReleases.mockReturnValueOnce({
      datasource: 'npm',
      depName: 'a',
      sourceUrl: '/a/',
    });
    const res = await datasource.fetchReleases({
      datasource: 'npm',
      depName: 'a',
    });
    expect(res.sourceUrl).toEqual(undefined);
    expect(res.homepage).toEqual('/a/');
  });
  it('test sourceUrl -> self-hosted bitbucket withcustom fqdn', async () => {
    const url = 'https://somebitbucket.org/abc/edf.git';
    hostRules.hosts.mockImplementationOnce(() => {
      return ['somebitbucket.org'];
    });
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://somebitbucket.org/abc/edf');
  });
  it('test sourceUrl -> bitbucket public service', async () => {
    const url = 'https://bitbucket.org/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://bitbucket.org/abc/edf');
  });
  it('test sourceUrl -> self-hosted bitbucket url git -> https', async () => {
    hostRules.hosts.mockImplementation(param => {
      let ret: any;
      if (param.hostType === 'bitbucket-server') {
        ret = ['bitbuckethost.org'];
      } else {
        ret = [];
      }
      return ret;
    });
    const url = 'git:bitbuckethost.org/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('https://bitbuckethost.org/abc/edf');
  });
  it('test sourceUrl -> self-hosted bitbucket  http -> http', async () => {
    hostRules.hosts.mockImplementation(param => {
      let ret: any;
      if (param.hostType === 'bitbucket-server') {
        ret = ['bitbuckethost.org'];
      } else {
        ret = [];
      }
      return ret;
    });
    const url = 'http://bitbuckethost.org/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('http://bitbuckethost.org/abc/edf');
  });
  it('test sourceUrl  -> self-hosted gitlab  http -> http', async () => {
    hostRules.hosts.mockImplementation(param => {
      let ret: any;
      if (param.hostType === 'gitlab') {
        ret = ['gitlabhost.com'];
      } else {
        ret = [];
      }
      return ret;
    });
    const url = 'http://gitlabhost.com/abc/edf.git';
    const res = await datasource.baseUrlLegacyMassager(url);
    expect(res).toEqual('http://gitlabhost.com/abc/edf');
  });
});
