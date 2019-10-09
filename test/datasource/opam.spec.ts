import * as fs from 'fs';

import _got from '../../lib/util/got';
import { getPkgReleases } from '../../lib/datasource/opam';

const got: any = _got;

const versionsResBody = fs.readFileSync(
  'test/datasource/opam/_fixtures/versions-res.json',
  'utf8'
);

const packageResBody = fs.readFileSync(
  'test/datasource/opam/_fixtures/package-res.json',
  'utf8'
);

const notFoundResBody = fs.readFileSync(
  'test/datasource/opam/_fixtures/not-found-res.json',
  'utf8'
);

jest.mock('../../lib/util/got');

describe('datasource/opam', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null if first requests to GitHub API has failed with 404 not found error', async () => {
      got.mockRejectedValueOnce({
        statusCode: 404,
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).toBeNull();
    });
    it('throws for 5xx errors', async () => {
      got.mockRejectedValueOnce({
        statusCode: 500,
      });
      expect(getPkgReleases({ lookupName: '0install' })).rejects.toThrow();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).toBeNull();
    });
    it('returns versions without homepage field if second request to GitHub API has failed with 404 not found error', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockRejectedValueOnce({
        statusCode: 404,
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions if both requests to GitHub API are successful', async () => {
      global.repoCache = {};
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: JSON.parse(packageResBody),
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).toBeDefined();
      expect(res).toMatchSnapshot();
    });
  });
});
