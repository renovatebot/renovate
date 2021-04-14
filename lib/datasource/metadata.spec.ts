import { getName } from '../../test/util';
import * as datasourceMaven from './maven';
import { addMetaData } from './metadata';
import * as datasourceNpm from './npm';
import * as datasourcePypi from './pypi';

describe(getName(__filename), () => {
  it('Should do nothing if dep is not specified', () => {
    expect(addMetaData()).toBeUndefined();
  });

  it('Should handle manualChangelogUrls', () => {
    const dep = {
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

    const datasource = datasourcePypi.id;
    const lookupName = 'django';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
  });

  it('Should handle manualSourceUrls', () => {
    const dep = {
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

    const datasource = datasourcePypi.id;
    const lookupName = 'mkdocs';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
  });

  it('Should handle parsing of sourceUrls correctly', () => {
    const dep = {
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
    const datasource = datasourcePypi.id;
    const lookupName = 'django-filter';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
  });

  it('Should handle parsing of sourceUrls correctly for GitLab also', () => {
    const dep = {
      sourceUrl: 'https://gitlab.com/meno/dropzone/tree/master',
      releases: [
        { version: '5.7.0', releaseTimestamp: '2020-02-14T13:12:00.000Z' },
        {
          version: '5.6.1',
          releaseTimestamp: '2020-02-14T10:04:00.000Z',
        },
      ],
    };
    const datasource = datasourceNpm.id;
    const lookupName = 'dropzone';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
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
    const datasource = datasourceNpm.id;
    const lookupName = 'dropzone';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
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
    const datasource = datasourceNpm.id;
    const lookupName = 'dropzone';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
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
    const datasource = datasourceNpm.id;
    const lookupName = 'dropzone';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
  });

  it('Should handle parsing/converting of GitHub sourceUrls with http and www correctly', () => {
    const dep = {
      sourceUrl: 'http://www.github.com/mockk/mockk/',
      releases: [{ version: '1.9.3' }],
    };
    const datasource = datasourceMaven.id;
    const lookupName = 'io.mockk:mockk';

    addMetaData(dep, datasource, lookupName);
    expect(dep.sourceUrl).toEqual('https://github.com/mockk/mockk');
  });

  it('Should move github homepage to sourceUrl', () => {
    const dep = {
      homepage: 'http://www.github.com/mockk/mockk/',
      releases: [{ version: '1.9.3' }],
      sourceUrl: undefined,
    };
    const datasource = datasourceMaven.id;
    const lookupName = 'io.mockk:mockk';

    addMetaData(dep, datasource, lookupName);
    expect(dep.sourceUrl).toEqual('https://github.com/mockk/mockk');
    expect(dep.homepage).toBeUndefined();
  });

  it('Should handle parsing/converting of GitLab sourceUrls with http and www correctly', () => {
    const dep = {
      sourceUrl: 'http://gitlab.com/meno/dropzone/',
      releases: [{ version: '5.7.0' }],
    };
    const datasource = datasourceMaven.id;
    const lookupName = 'dropzone';

    addMetaData(dep, datasource, lookupName);
    expect(dep.sourceUrl).toEqual('https://gitlab.com/meno/dropzone');
  });

  it('Should normalize releaseTimestamp', () => {
    const dep = {
      releases: [
        { version: '1.0.1', releaseTimestamp: '2000-01-01T12:34:56' },
        { version: '1.0.2', releaseTimestamp: '2000-01-02T12:34:56.000Z' },
        { version: '1.0.3', releaseTimestamp: '2000-01-03T14:34:56.000+02:00' },
      ],
    };
    addMetaData(dep, datasourceMaven.id, 'foobar');
    expect(dep.releases).toMatchObject([
      { releaseTimestamp: '2000-01-01T12:34:56.000Z' },
      { releaseTimestamp: '2000-01-02T12:34:56.000Z' },
      { releaseTimestamp: '2000-01-03T12:34:56.000Z' },
    ]);
  });
});
