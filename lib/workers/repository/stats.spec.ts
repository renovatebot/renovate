import { logger, mocked } from '../../../test/util';
import type { Logger } from '../../logger/types';
import * as _memCache from '../../util/cache/memory';
import type { LookupStats } from '../../util/cache/memory/types';
import type { RequestStats } from '../../util/http/types';
import { printLookupStats, printRequestStats } from './stats';

jest.mock('../../util/cache/memory');

const memCache = mocked(_memCache);
const log = logger.logger as jest.Mocked<Logger>;

describe('workers/repository/stats', () => {
  describe('printLookupStats()', () => {
    it('runs', () => {
      const stats: LookupStats[] = [
        {
          datasource: 'npm',
          duration: 100,
        },
        {
          datasource: 'npm',
          duration: 200,
        },
        {
          datasource: 'docker',
          duration: 1000,
        },
      ];
      memCache.get.mockImplementationOnce(() => stats as any);
      expect(printLookupStats()).toBeUndefined();
      expect(log.debug).toHaveBeenCalledTimes(1);
      expect(log.debug.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "docker": {
            "averageMs": 1000,
            "count": 1,
            "maximumMs": 1000,
            "totalMs": 1000,
          },
          "npm": {
            "averageMs": 150,
            "count": 2,
            "maximumMs": 200,
            "totalMs": 300,
          },
        }
      `);
    });
  });

  describe('printRequestStats()', () => {
    it('runs', () => {
      const getStats: number[] = [30, 100, 10, 20];
      // TODO: fix types, jest is using wrong overload (#7154)
      memCache.get.mockImplementationOnce(() => getStats as any);
      const setStats: number[] = [110, 80, 20];
      // TODO: fix types, jest is using wrong overload (#7154)
      memCache.get.mockImplementationOnce(() => setStats as any);
      const httpStats: RequestStats[] = [
        {
          method: 'get',
          url: 'https://api.github.com/api/v3/user',
          duration: 100,
          queueDuration: 0,
          statusCode: 200,
        },
        {
          method: 'post',
          url: 'https://api.github.com/graphql',
          duration: 130,
          queueDuration: 0,
          statusCode: 401,
        },
        {
          method: 'post',
          url: 'https://api.github.com/graphql',
          duration: 150,
          queueDuration: 0,
          statusCode: 200,
        },
        {
          method: 'post',
          url: 'https://api.github.com/graphql',
          duration: 20,
          queueDuration: 10,
          statusCode: 200,
        },
        {
          method: 'get',
          url: 'https://api.github.com/api/v3/repositories',
          duration: 500,
          queueDuration: 0,
          statusCode: 500,
        },
        {
          method: 'get',
          url: 'https://auth.docker.io',
          duration: 200,
          queueDuration: 0,
          statusCode: 401,
        },
      ];
      // TODO: fix types, jest is using wrong overload (#7154)
      memCache.get.mockImplementationOnce(() => httpStats as any);
      expect(printRequestStats()).toBeUndefined();
      expect(log.trace).toHaveBeenCalledOnce();
      expect(log.debug).toHaveBeenCalledTimes(2);
      expect(log.trace.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "allRequests": [
            "GET https://api.github.com/api/v3/repositories 500 500 0",
            "GET https://api.github.com/api/v3/user 200 100 0",
            "POST https://api.github.com/graphql 401 130 0",
            "POST https://api.github.com/graphql 200 150 0",
            "POST https://api.github.com/graphql 200 20 10",
            "GET https://auth.docker.io 401 200 0",
          ],
          "requestHosts": {
            "api.github.com": [
              {
                "duration": 500,
                "method": "get",
                "queueDuration": 0,
                "statusCode": 500,
                "url": "https://api.github.com/api/v3/repositories",
              },
              {
                "duration": 100,
                "method": "get",
                "queueDuration": 0,
                "statusCode": 200,
                "url": "https://api.github.com/api/v3/user",
              },
              {
                "duration": 130,
                "method": "post",
                "queueDuration": 0,
                "statusCode": 401,
                "url": "https://api.github.com/graphql",
              },
              {
                "duration": 150,
                "method": "post",
                "queueDuration": 0,
                "statusCode": 200,
                "url": "https://api.github.com/graphql",
              },
              {
                "duration": 20,
                "method": "post",
                "queueDuration": 10,
                "statusCode": 200,
                "url": "https://api.github.com/graphql",
              },
            ],
            "auth.docker.io": [
              {
                "duration": 200,
                "method": "get",
                "queueDuration": 0,
                "statusCode": 401,
                "url": "https://auth.docker.io",
              },
            ],
          },
        }
      `);
      expect(log.debug.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "get": {
            "avgMs": 40,
            "count": 4,
            "maxMs": 100,
            "medianMs": 20,
          },
          "set": {
            "avgMs": 70,
            "count": 3,
            "maxMs": 110,
            "medianMs": 80,
          },
        }
      `);
      expect(log.debug.mock.calls[1][0]).toMatchInlineSnapshot(`
        {
          "hostStats": {
            "api.github.com": {
              "queueAvgMs": 2,
              "requestAvgMs": 180,
              "requestCount": 5,
            },
            "auth.docker.io": {
              "queueAvgMs": 0,
              "requestAvgMs": 200,
              "requestCount": 1,
            },
          },
          "totalRequests": 6,
          "urls": {
            "https://api.github.com/api/v3/repositories (GET,500)": 1,
            "https://api.github.com/api/v3/user (GET,200)": 1,
            "https://api.github.com/graphql (POST,200)": 2,
            "https://api.github.com/graphql (POST,401)": 1,
            "https://auth.docker.io (GET,401)": 1,
          },
        }
      `);
    });
  });
});
