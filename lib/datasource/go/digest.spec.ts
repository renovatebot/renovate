import * as httpMock from '../../../test/http-mock';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { getDigest } from './digest';

jest.mock('../../util/host-rules');

const hostRules = mocked(_hostRules);

const res1 = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta name="go-import" content="golang.org/x/text git https://go.googlesource.com/text">
<meta name="go-source" content="golang.org/x/text https://github.com/golang/text/ https://github.com/golang/text/tree/master{/dir} https://github.com/golang/text/blob/master{/dir}/{file}#L{line}">
<meta http-equiv="refresh" content="0; url=https://godoc.org/golang.org/x/text">
</head>
<body>
Nothing to see here; <a href="https://godoc.org/golang.org/x/text">move along</a>.
</body>
</html>`;

describe('datasource/go/digest', () => {
  beforeEach(() => {
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getDigest', () => {
    it('returns null for no go-source tag', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, '');
      const res = await getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for wrong name', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/y/text?go-get=1')
        .reply(200, res1);
      const res = await getDigest({ lookupName: 'golang.org/y/text' }, null);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gitlab digest is not supported at the moment', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get('/golang/text?go-get=1')
        .reply(200, '');
      const res = await getDigest(
        { lookupName: 'gitlab.com/golang/text' },
        null
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns digest', async () => {
      httpMock
        .scope('https://golang.org/')
        .get('/x/text?go-get=1')
        .reply(200, res1);
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/golang/text/commits?per_page=1')
        .reply(200, [{ sha: 'abcdefabcdefabcdefabcdef' }]);
      const res = await getDigest({ lookupName: 'golang.org/x/text' }, null);
      expect(res).toBe('abcdefabcdefabcdefabcdef');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('support bitbucket digest', async () => {
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/golang/text')
        .reply(200, { mainbranch: { name: 'master' } });
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/golang/text/commits/master')
        .reply(200, {
          pagelen: 1,
          values: [
            {
              hash: '123',
              date: '2020-11-19T09:05:35+00:00',
            },
          ],
          page: 1,
        });
      const res = await getDigest(
        {
          lookupName: 'bitbucket.org/golang/text',
        },
        null
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
