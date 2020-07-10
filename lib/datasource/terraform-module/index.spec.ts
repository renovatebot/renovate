import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import { id as datasource } from '.';

const consulData: any = fs.readFileSync(
  'lib/datasource/terraform-module/__fixtures__/registry-consul.json'
);

const baseUrl = 'https://registry.terraform.io';

describe('datasource/terraform-module', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName: 'hashicorp/consul/aws',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(404, {});
      expect(
        await getPkgReleases({
          datasource,
          depName: 'hashicorp/consul/aws',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'hashicorp/consul/aws',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, consulData);
      const res = await getPkgReleases({
        datasource,
        depName: 'hashicorp/consul/aws',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes with registry in name', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, consulData);
      const res = await getPkgReleases({
        datasource,
        depName: 'registry.terraform.io/hashicorp/consul/aws',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('rejects mismatch', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/consul/foo')
        .reply(200, consulData);
      const res = await getPkgReleases({
        datasource,
        depName: 'consul/foo',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
