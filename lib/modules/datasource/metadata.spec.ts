import { MavenDatasource } from './maven';
import {
  addMetaData,
  massageGithubUrl,
  shouldDeleteHomepage,
} from './metadata';
import { NpmDatasource } from './npm';
import { PypiDatasource } from './pypi';
import type { ReleaseResult } from './types';

describe('modules/datasource/metadata', () => {
  it('Should handle manualChangelogUrls', () => {
    const dep: ReleaseResult = {
      releases: [
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17.000Z' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16.000Z',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28.000Z' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00.000Z' },
      ],
    };

    const datasource = PypiDatasource.id;
    const packageName = 'django';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      changelogUrl:
        'https://github.com/django/django/tree/master/docs/releases',
    });
  });

  it('Should handle manualSourceUrls', () => {
    const dep: ReleaseResult = {
      releases: [
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17.000Z' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16.000Z',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28.000Z' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00.000Z' },
      ],
    };

    const datasource = PypiDatasource.id;
    const packageName = 'mkdocs';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      sourceUrl: 'https://github.com/mkdocs/mkdocs',
    });
  });

  it('Should handle parsing of sourceUrls correctly', () => {
    const dep: ReleaseResult = {
      sourceUrl: 'https://github.com/carltongibson/django-filter/tree/master',
      releases: [
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17.000Z' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16.000Z',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28.000Z' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00.000Z' },
      ],
    };
    const datasource = PypiDatasource.id;
    const packageName = 'django-filter';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      sourceUrl: 'https://github.com/carltongibson/django-filter',
    });
  });

  it('Should massage github sourceUrls', () => {
    const dep: ReleaseResult = {
      sourceUrl: 'https://some.github.com/repo',
      releases: [
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17.000Z' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16.000Z',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28.000Z' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00.000Z' },
      ],
    };
    const datasource = PypiDatasource.id;
    const packageName = 'django-filter';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      sourceUrl: 'https://github.com/some/repo',
    });
  });

  it('Should handle parsing of sourceUrls correctly for GitLab also', () => {
    const dep: ReleaseResult = {
      sourceUrl: 'https://gitlab.com/meno/dropzone/tree/master',
      releases: [
        { version: '5.7.0', releaseTimestamp: '2020-02-14T13:12:00.000Z' },
        {
          version: '5.6.1',
          releaseTimestamp: '2020-02-14T10:04:00.000Z',
        },
      ],
    };
    const datasource = NpmDatasource.id;
    const packageName = 'dropzone';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      sourceUrl: 'https://gitlab.com/meno/dropzone',
    });
  });

  it('Should handle failed parsing of sourceUrls for GitLab', () => {
    const dep = {
      sourceUrl: 'https://gitlab-nope',
      releases: [
        { version: '5.7.0', releaseTimestamp: '2020-02-14T13:12:00.000Z' },
        {
          version: '5.6.1',
          releaseTimestamp: '2020-02-14T10:04:00.000Z',
        },
      ],
    };
    const datasource = NpmDatasource.id;
    const packageName = 'dropzone';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      sourceUrl: 'https://gitlab-nope',
    });
  });

  it('Should handle failed parsing of sourceUrls for other', () => {
    const dep = {
      sourceUrl: 'https://nope-nope-nope',
      releases: [
        { version: '5.7.0', releaseTimestamp: '2020-02-14T13:12:00.000Z' },
        {
          version: '5.6.1',
          releaseTimestamp: '2020-02-14T10:04:00.000Z',
        },
      ],
    };
    const datasource = NpmDatasource.id;
    const packageName = 'dropzone';

    addMetaData(dep, datasource, packageName);
    expect(dep).toMatchSnapshot({
      sourceUrl: 'https://nope-nope-nope',
    });
  });

  it('Should handle non-url', () => {
    const dep = {
      sourceUrl: 'not-a-url',
      releases: [
        { version: '5.7.0', releaseTimestamp: '2020-02-14T13:12:00.000Z' },
        {
          version: '5.6.1',
          releaseTimestamp: '2020-02-14T10:04:00.000Z',
        },
      ],
    };
    const datasource = NpmDatasource.id;
    const packageName = 'dropzone';

    addMetaData(dep, datasource, packageName);
    expect(dep).not.toContainKey('sourceUrl');
    expect(dep).toMatchSnapshot();
  });

  it('Should handle parsing/converting of GitHub sourceUrls with http and www correctly', () => {
    const dep = {
      sourceUrl: 'http://www.github.com/mockk/mockk/',
      releases: [{ version: '1.9.3' }],
    };
    const datasource = MavenDatasource.id;
    const packageName = 'io.mockk:mockk';

    addMetaData(dep, datasource, packageName);
    expect(dep.sourceUrl).toBe('https://github.com/mockk/mockk');
  });

  it('Should move github homepage to sourceUrl', () => {
    const dep = {
      homepage: 'http://www.github.com/mockk/mockk/',
      releases: [{ version: '1.9.3' }],
      sourceUrl: undefined,
    };
    const datasource = MavenDatasource.id;
    const packageName = 'io.mockk:mockk';

    addMetaData(dep, datasource, packageName);
    expect(dep.sourceUrl).toBe('https://github.com/mockk/mockk');
    expect(dep.homepage).toBeUndefined();
  });

  it('Should handle parsing/converting of GitLab sourceUrls with http and www correctly', () => {
    const dep = {
      sourceUrl: 'http://gitlab.com/meno/dropzone/',
      releases: [{ version: '5.7.0' }],
    };
    const datasource = MavenDatasource.id;
    const packageName = 'dropzone';

    addMetaData(dep, datasource, packageName);
    expect(dep.sourceUrl).toBe('https://gitlab.com/meno/dropzone');
  });

  it('Should normalize releaseTimestamp', () => {
    const dep = {
      releases: [
        { version: '1.0.1', releaseTimestamp: '2000-01-01T12:34:56' },
        { version: '1.0.2', releaseTimestamp: '2000-01-02T12:34:56.000Z' },
        { version: '1.0.3', releaseTimestamp: '2000-01-03T14:34:56.000+02:00' },
      ],
    };
    addMetaData(dep, MavenDatasource.id, 'foobar');
    expect(dep.releases).toMatchObject([
      { releaseTimestamp: '2000-01-01T12:34:56.000Z' },
      { releaseTimestamp: '2000-01-02T12:34:56.000Z' },
      { releaseTimestamp: '2000-01-03T12:34:56.000Z' },
    ]);
  });

  it('Should massage github git@ url to valid https url', () => {
    expect(massageGithubUrl('git@example.com:foo/bar')).toMatch(
      'https://example.com/foo/bar'
    );
  });

  it('Should massage github http url to valid https url', () => {
    expect(massageGithubUrl('http://example.com/foo/bar')).toMatch(
      'https://example.com/foo/bar'
    );
  });

  it('Should massage github http and git url to valid https url', () => {
    expect(massageGithubUrl('http+git://example.com/foo/bar')).toMatch(
      'https://example.com/foo/bar'
    );
  });

  it('Should massage github ssh git@ url to valid https url', () => {
    expect(massageGithubUrl('ssh://git@example.com/foo/bar')).toMatch(
      'https://example.com/foo/bar'
    );
  });

  it('Should massage github git url to valid https url', () => {
    expect(massageGithubUrl('git://example.com/foo/bar')).toMatch(
      'https://example.com/foo/bar'
    );
  });

  it('Should remove homepage when homepage and sourceUrl are same', () => {
    const dep = {
      homepage: 'https://github.com/foo/bar',
      sourceUrl: 'https://github.com/foo/bar',
      releases: [
        { version: '1.0.1', releaseTimestamp: '2000-01-01T12:34:56' },
        { version: '1.0.2', releaseTimestamp: '2000-01-02T12:34:56.000Z' },
        { version: '1.0.3', releaseTimestamp: '2000-01-03T14:34:56.000+02:00' },
      ],
    };
    addMetaData(dep, MavenDatasource.id, 'foobar');
    expect(dep).toMatchObject({
      releases: [
        {
          version: '1.0.1',
          releaseTimestamp: '2000-01-01T12:34:56.000Z',
        },
        {
          version: '1.0.2',
          releaseTimestamp: '2000-01-02T12:34:56.000Z',
        },
        {
          version: '1.0.3',
          releaseTimestamp: '2000-01-03T12:34:56.000Z',
        },
      ],
      sourceUrl: 'https://github.com/foo/bar',
    });
  });

  it('Should delete gitlab homepage if its same as sourceUrl', () => {
    const dep = {
      sourceUrl: 'https://gitlab.com/meno/repo',
      homepage: 'https://gitlab.com/meno/repo',
      releases: [
        { version: '1.0.1', releaseTimestamp: '2000-01-01T12:34:56' },
        { version: '1.0.2', releaseTimestamp: '2000-01-02T12:34:56.000Z' },
        { version: '1.0.3', releaseTimestamp: '2000-01-03T14:34:56.000+02:00' },
      ],
    };
    addMetaData(dep, MavenDatasource.id, 'foobar');
    expect(dep).toMatchObject({
      sourceUrl: 'https://gitlab.com/meno/repo',
      releases: [
        {
          version: '1.0.1',
          releaseTimestamp: '2000-01-01T12:34:56.000Z',
        },
        {
          version: '1.0.2',
          releaseTimestamp: '2000-01-02T12:34:56.000Z',
        },
        {
          version: '1.0.3',
          releaseTimestamp: '2000-01-03T12:34:56.000Z',
        },
      ],
    });
  });

  it('does not set homepage to sourceURl when undefined', () => {
    const dep = {
      sourceUrl: 'https://gitlab.com/meno/repo',
      releases: [
        { version: '1.0.1', releaseTimestamp: '2000-01-01T12:34:56' },
        { version: '1.0.2', releaseTimestamp: '2000-01-02T12:34:56.000Z' },
        { version: '1.0.3', releaseTimestamp: '2000-01-03T14:34:56.000+02:00' },
      ],
    };
    addMetaData(dep, MavenDatasource.id, 'foobar');
    expect(dep).toMatchObject({
      sourceUrl: 'https://gitlab.com/meno/repo',
      releases: [
        {
          version: '1.0.1',
          releaseTimestamp: '2000-01-01T12:34:56.000Z',
        },
        {
          version: '1.0.2',
          releaseTimestamp: '2000-01-02T12:34:56.000Z',
        },
        {
          version: '1.0.3',
          releaseTimestamp: '2000-01-03T12:34:56.000Z',
        },
      ],
    });
  });

  it('does not set homepage to sourceURl when not github or gitlab', () => {
    const dep = {
      homepage: 'https://somesource.com/',
      releases: [
        { version: '1.0.1', releaseTimestamp: '2000-01-01T12:34:56' },
        { version: '1.0.2', releaseTimestamp: '2000-01-02T12:34:56.000Z' },
        { version: '1.0.3', releaseTimestamp: '2000-01-03T14:34:56.000+02:00' },
      ],
    };
    addMetaData(dep, MavenDatasource.id, 'foobar');
    expect(dep).toMatchObject({
      homepage: 'https://somesource.com/',
      releases: [
        {
          version: '1.0.1',
          releaseTimestamp: '2000-01-01T12:34:56.000Z',
        },
        {
          version: '1.0.2',
          releaseTimestamp: '2000-01-02T12:34:56.000Z',
        },
        {
          version: '1.0.3',
          releaseTimestamp: '2000-01-03T12:34:56.000Z',
        },
      ],
    });
  });

  test.each`
    sourceUrl                              | homepage                                                                   | expected
    ${'not a url'}                         | ${'https://gitlab.com/org/repo'}                                           | ${false}
    ${'https://gitlab.com/org/repo'}       | ${'not a url'}                                                             | ${false}
    ${'https://gitlab.com/org'}            | ${'https://gitlab.com/org/'}                                               | ${true}
    ${'https://gitlab.com/org/repo/'}      | ${'https://gitlab.com/org/repo'}                                           | ${true}
    ${'https://github.com/org/repo/path/'} | ${'https://github.com/org/repo/path/'}                                     | ${false}
    ${'https://gitlab.com/org/repo/'}      | ${'https://gitlab.com/org/repo/path/to/something/'}                        | ${false}
    ${'https://gitlab.com/org/repo/'}      | ${null}                                                                    | ${false}
    ${'https://gitlab.com/org/repo/'}      | ${undefined}                                                               | ${false}
    ${'https://gitlab.com/org/repo/'}      | ${'github.com'}                                                            | ${false}
    ${'https://github.com/bitnami/charts'} | ${'https://github.com/bitnami/charts/tree/master/bitnami/kube-prometheus'} | ${false}
  `(
    'shouldDeleteHomepage($sourceUrl, $homepage) -> $expected',
    ({ sourceUrl, homepage, expected }) => {
      expect(shouldDeleteHomepage(sourceUrl, homepage)).toBe(expected);
    }
  );
});
