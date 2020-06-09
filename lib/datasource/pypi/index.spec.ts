import fs from 'fs';
import _got from '../../util/got';
import * as pypi from '.';

jest.mock('../../util/got');

const got: any = _got;

const res1: any = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/azure-cli-monitor.json'
);
const htmlResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html.html'
);
const badResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-badfile.html'
);
const mixedHyphensResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-mixed-hyphens.html'
);

describe('datasource/pypi', () => {
  describe('getReleases', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({});
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      expect(
        await pypi.getReleases({
          lookupName: 'azure-cli-monitor',
        })
      ).toMatchSnapshot();
    });
    it('supports custom datasource url', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      const config = {
        registryUrls: ['https://custom.pypi.net/foo'],
      };
      await pypi.getReleases({
        ...config,
        lookupName: 'azure-cli-monitor',
      });
      expect(got.mock.calls).toMatchSnapshot();
    });
    it('supports custom datasource url from environmental variable', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(res1),
      });
      const pipIndexUrl = process.env.PIP_INDEX_URL;
      process.env.PIP_INDEX_URL = 'https://my.pypi.python/pypi/';
      await pypi.getReleases({
        lookupName: 'azure-cli-monitor',
      });
      expect(got.mock.calls).toMatchSnapshot();
      process.env.PIP_INDEX_URL = pipIndexUrl;
    });
    it('supports multiple custom datasource urls', async () => {
      got
        .mockImplementationOnce(() => {
          throw new Error();
        })
        .mockImplementationOnce(() => ({ body: JSON.parse(res1) }));
      const config = {
        registryUrls: [
          'https://custom.pypi.net/foo',
          'https://second-index/foo',
          'https://third-index/foo',
        ],
      };
      await pypi.getReleases({
        ...config,
        lookupName: 'azure-cli-monitor',
      });
      expect(got.mock.calls).toMatchSnapshot();
    });
    it('returns non-github home_page', async () => {
      got.mockReturnValueOnce({
        body: {
          info: {
            name: 'something',
            home_page: 'https://microsoft.com',
          },
        },
      });
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toMatchSnapshot();
    });
    it('find url from project_urls', async () => {
      const info = {
        name: 'flexget',
        home_page: 'https://flexget.com',
        project_urls: {
          Forum: 'https://discuss.flexget.com',
          Homepage: 'https://flexget.com',
          changelog: 'https://github.com/Flexget/wiki/blob/master/ChangeLog.md',
          'Issue Tracker': 'https://github.com/Flexget/Flexget/issues',
          Repository: 'https://github.com/Flexget/Flexget',
        },
      };
      got.mockReturnValueOnce({
        body: {
          info,
        },
      });
      const result = await pypi.getReleases({
        lookupName: 'flexget',
      });
      expect(result.sourceUrl).toBe(info.project_urls.Repository);
      expect(result.changelogUrl).toBe(info.project_urls.changelog);
      expect(result).toMatchSnapshot();
    });
    it('returns null if mismatched name', async () => {
      got.mockReturnValueOnce({
        body: {
          info: {
            name: 'something-else',
            home_page: 'https://microsoft.com',
          },
        },
      });
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toBeNull();
    });

    it('respects compatibility', async () => {
      got.mockReturnValueOnce({
        body: {
          info: {
            name: 'doit',
          },
          releases: {
            '0.30.3': [{ requires_python: null }],
            '0.31.0': [
              { requires_python: '>=3.4' },
              { requires_python: '>=2.7' },
            ],
            '0.31.1': [{ requires_python: '>=3.4' }],
            '0.4.0': [{ requires_python: '>=3.4' }, { requires_python: null }],
          },
        },
      });
      expect(
        await pypi.getReleases({
          compatibility: { python: '2.7' },
          lookupName: 'doit',
        })
      ).toMatchSnapshot();
    });
    it('process data from simple endpoint', async () => {
      got.mockReturnValueOnce({
        body: htmlResponse + '',
      });
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toMatchSnapshot();
    });
    it('process data from +simple endpoint', async () => {
      got.mockReturnValueOnce({
        body: htmlResponse + '',
      });
      const config = {
        registryUrls: ['https://some.registry.org/+simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toMatchSnapshot();
    });
    it('process data from simple endpoint with hyphens replaced with underscores', async () => {
      got.mockReturnValueOnce({
        body: mixedHyphensResponse + '',
      });
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'image-collector',
        })
      ).toMatchSnapshot();
    });
    it('returns null for empty response', async () => {
      got.mockReturnValueOnce({});
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toBeNull();
    });
    it('returns null for 404 response from simple endpoint', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toBeNull();
    });
    it('returns null for response with no versions', async () => {
      got.mockReturnValueOnce({
        body: badResponse + '',
      });
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toEqual({ releases: [] });
    });
  });
});
