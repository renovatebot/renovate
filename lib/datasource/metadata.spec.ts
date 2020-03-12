import { addMetaData } from './metadata';
import * as datasourceMaven from './maven';
import * as datasourcePypi from './pypi';

describe('datasource/metadata', () => {
  it('Should do nothing if dep is not specified', () => {
    expect(addMetaData()).toBeUndefined();
  });

  it('Should handle manualChangelogUrls', () => {
    const dep = {
      releases: [
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00' },
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
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00' },
      ],
    };

    const datasource = datasourcePypi.id;
    const lookupName = 'coverage';

    addMetaData(dep, datasource, lookupName);
    expect(dep).toMatchSnapshot();
  });

  it('Should handle parsing of sourceUrls correctly', () => {
    const dep = {
      sourceUrl: 'https://github.com/carltongibson/django-filter/tree/master',
      releases: [
        { version: '2.0.0', releaseTimestamp: '2018-07-13T10:14:17' },
        {
          version: '2.0.0.dev1',
          releaseTimestamp: '2017-10-24T10:09:16',
        },
        { version: '2.1.0', releaseTimestamp: '2019-01-20T19:59:28' },
        { version: '2.2.0', releaseTimestamp: '2019-07-16T18:29:00' },
      ],
    };
    const datasource = datasourcePypi.id;
    const lookupName = 'django-filter';

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
});
