const { addMetaData } = require('../../lib/datasource/metadata');

describe('TEST addMetaData()', () => {
  it('Should return nothing if dep is not provided', () => {
    const result = addMetaData();
    expect(result).toBeUndefined();
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
    const datasource = 'pypi';
    const lookupName = 'django';
    const result = addMetaData(dep, datasource, lookupName);
    expect(result).toMatchSnapshot();
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
    const datasource = 'pypi';
    const lookupName = 'coverage';
    const result = addMetaData(dep, datasource, lookupName);
    expect(result).toMatchSnapshot();
  });

  it('Should parse sourceUrl correctly', () => {
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
    const datasource = 'pypi';
    const lookupName = 'django-filter';
    const result = addMetaData(dep, datasource, lookupName);
    expect(result).toMatchSnapshot();
  });
});
