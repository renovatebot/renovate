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
    it('throws for 5xx errors', () => {
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
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from(
            'homep_INVALID_age: "http://0install.net"'
          ).toString('base64'),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from('homepage http://0install.net').toString(
            'base64'
          ),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from('homepage: http://0install.net').toString(
            'base64'
          ),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from('homepage: "http://0install.net').toString(
            'base64'
          ),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from('homepage  "http://0install.net" :').toString(
            'base64'
          ),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from(
            'homepage: \' some_thing \' homepage: "http://0install.net"'
          ).toString('base64'),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions without homepage field if homepage field is invalid', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from('homepage:\n other_thing: "some data"').toString(
            'base64'
          ),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).not.toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('handles line comments in opam files', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from(
            `
# comment
# homepage: "http://commented.out"
homepage: "http://0install.net"
`
          ).toString('base64'),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('handles multi-line comments in opam files', async () => {
      got.mockResolvedValueOnce({
        body: JSON.parse(versionsResBody),
      });
      got.mockResolvedValueOnce({
        body: {
          content: Buffer.from(
            `
(*
Multi line comment
homepage "http://commented.out"
*)
homepage: "http://0install.net"
`
          ).toString('base64'),
        },
      });
      const res = await getPkgReleases({ lookupName: '0install' });
      expect(res).not.toBeNull();
      expect(res.homepage).toBeDefined();
      expect(res).toMatchSnapshot();
    });
    it('returns versions and homepage if both requests to GitHub API are successful', async () => {
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
