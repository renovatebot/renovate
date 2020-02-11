import * as datasource from '.';
import * as _npm from './npm';
import {
  DATASOURCE_DOCKER,
  DATASOURCE_GITHUB,
  DATASOURCE_NPM,
} from '../constants/data-binary-source';

jest.mock('./docker');
jest.mock('./npm');

const npmDatasource: any = _npm;

describe('datasource/index', () => {
  it('returns if digests are supported', () => {
    expect(datasource.supportsDigests({ datasource: DATASOURCE_GITHUB })).toBe(
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
        datasource: DATASOURCE_DOCKER,
        depName: 'docker/node',
      })
    ).toBeUndefined();
  });
  it('adds changelogUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      datasource: DATASOURCE_NPM,
      depName: 'react-native',
    });
    expect(res).toMatchSnapshot();
    expect(res.changelogUrl).toBeDefined();
    expect(res.sourceUrl).toBeDefined();
  });
  it('adds sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({});
    const res = await datasource.getPkgReleases({
      datasource: DATASOURCE_NPM,
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
      datasource: DATASOURCE_NPM,
      depName: 'abc',
    });
    expect(res.sourceUrl).toEqual('https://abc.com');
  });
  it('massages sourceUrl', async () => {
    npmDatasource.getPkgReleases.mockReturnValue({
      sourceUrl: 'scm:git@github.com:Jasig/cas.git',
    });
    const res = await datasource.getPkgReleases({
      datasource: DATASOURCE_NPM,
      depName: 'cas',
    });
    expect(res.sourceUrl).toEqual('https://github.com/Jasig/cas');
  });
});
