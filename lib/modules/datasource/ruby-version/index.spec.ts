import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { getPkgReleases } from '../index.ts';
import { RubyVersionDatasource } from './index.ts';

const datasource = RubyVersionDatasource.id;

describe('modules/datasource/ruby-version/index', () => {
  describe('getReleases', () => {
    it('parses real data', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, Fixtures.get('releases.html'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'ruby',
      });
      expect(res).toEqual({
        homepage: 'https://www.ruby-lang.org',
        sourceUrl: 'https://github.com/ruby/ruby',
        registryUrl: 'https://www.ruby-lang.org/',
        releases: expect.any(Array),
      });
      expect(res?.releases).toHaveLength(133);
      expect(res?.releases[0]).toEqual({
        changelogUrl:
          'https://www.ruby-lang.org/en/news/2002/03/01/167-is-released/',
        releaseTimestamp: '2002-03-01T00:00:00.000Z',
        version: '1.6.7',
      });
      // preview version
      expect(res?.releases[2]).toEqual({
        changelogUrl:
          'https://www.ruby-lang.org/en/news/2004/07/21/ruby-182-preview1-released/',
        releaseTimestamp: '2004-07-21T00:00:00.000Z',
        version: '1.8.2-preview1',
      });
      // patch level version
      expect(res?.releases[11]).toEqual({
        changelogUrl:
          'https://www.ruby-lang.org/en/news/2008/08/11/ruby-1-8-7-p72-and-1-8-6-p287-released/',
        releaseTimestamp: '2008-08-11T00:00:00.000Z',
        version: '1.8.6-p287',
      });
      // release candidate, followed by the final release of the same version
      expect(res?.releases.slice(70, 72)).toEqual([
        {
          changelogUrl:
            'https://www.ruby-lang.org/en/news/2013/02/08/ruby-2-0-0-rc2-is-released/',
          releaseTimestamp: '2013-02-08T00:00:00.000Z',
          version: '2.0.0-rc2',
        },
        {
          changelogUrl:
            'https://www.ruby-lang.org/en/news/2013/02/24/ruby-2-0-0-p0-is-released/',
          releaseTimestamp: '2013-02-24T00:00:00.000Z',
          version: '2.0.0',
        },
      ]);
      expect(res?.releases[123]).toEqual({
        changelogUrl:
          'https://www.ruby-lang.org/en/news/2017/12/25/ruby-2-5-0-released/',
        releaseTimestamp: '2017-12-25T00:00:00.000Z',
        version: '2.5.0',
      });
      expect(res?.releases.slice(-2)).toEqual([
        {
          changelogUrl:
            'https://www.ruby-lang.org/en/news/2018/12/15/ruby-2-6-0-rc2-released/',
          releaseTimestamp: '2018-12-15T00:00:00.000Z',
          version: '2.6.0-rc2',
        },
        {
          changelogUrl:
            'https://www.ruby-lang.org/en/news/2018/12/25/ruby-2-6-0-released/',
          releaseTimestamp: '2018-12-25T00:00:00.000Z',
          version: '2.6.0',
        },
      ]);
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(200, {});
      const res = await getPkgReleases({
        datasource,
        packageName: 'ruby',
      });
      expect(res).toBeNull();
    });

    it('throws for 404', async () => {
      httpMock
        .scope('https://www.ruby-lang.org')
        .get('/en/downloads/releases/')
        .reply(404);
      await expect(
        getPkgReleases({ datasource, packageName: 'ruby' }),
      ).rejects.toThrow('external-host-error');
    });
  });
});
