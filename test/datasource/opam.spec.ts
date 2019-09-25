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
    it('returns versions if both requests to GitHub API are successful', async () => {
      const versionsRes = {
        body: JSON.parse(versionsResBody),
      };
      const packageRes = {
        body: JSON.parse(packageResBody),
      };
      got.mockReturnValueOnce(versionsRes).mockReturnValueOnce(packageRes);
      let res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if second request to GitHub API has failed with not found error', async () => {
      const versionsRes = {
        body: JSON.parse(versionsResBody),
      };
      // TODO: Check how got actually handles 404 not foudn errors
      const packageRes = {
        body: JSON.parse(notFoundResBody),
        statusCode: 404,
      };
      got.mockReturnValueOnce(versionsRes).mockReturnValueOnce(packageRes);
      let res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
  });
});
