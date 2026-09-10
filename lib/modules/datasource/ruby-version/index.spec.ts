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
        releases: [
          {
            version: '1.6.7',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2002/03/01/167-is-released/',
            releaseTimestamp: '2002-03-01T00:00:00.000Z',
          },
          {
            version: '1.8.7',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2008/05/31/ruby-1-8-7-has-been-released/',
            releaseTimestamp: '2008-05-31T00:00:00.000Z',
          },
          {
            version: '1.9.3-p551',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2014/11/13/ruby-1-9-3-p551-is-released/',
            releaseTimestamp: '2014-11-13T00:00:00.000Z',
          },
          {
            version: '2.0.0-p648',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2015/12/16/ruby-2-0-0-p648-released/',
            releaseTimestamp: '2015-12-16T00:00:00.000Z',
          },
          {
            version: '2.5.3',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2018/10/18/ruby-2-5-3-released/',
            releaseTimestamp: '2018-10-18T00:00:00.000Z',
          },
          {
            version: '2.6.0-preview3',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2018/11/06/ruby-2-6-0-preview3-released/',
            releaseTimestamp: '2018-11-06T00:00:00.000Z',
          },
          {
            version: '2.6.0-rc2',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2018/12/15/ruby-2-6-0-rc2-released/',
            releaseTimestamp: '2018-12-15T00:00:00.000Z',
          },
          {
            version: '2.6.0',
            changelogUrl:
              'https://www.ruby-lang.org/en/news/2018/12/25/ruby-2-6-0-released/',
            releaseTimestamp: '2018-12-25T00:00:00.000Z',
          },
        ],
      });
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
