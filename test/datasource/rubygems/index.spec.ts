import _got from '../../../lib/util/got';
import railsInfo from './_fixtures/rails/info.json';
import railsVersions from './_fixtures/rails/versions.json';
import * as rubygems from '../../../lib/datasource/rubygems';

const got: any = _got;

const rubygemsOrgVersions = `created_at: 2017-03-27T04:38:13+00:00
---
- 1 05d0116933ba44b0b5d0ee19bfd35ccc
.cat 0.0.1 631fd60a806eaf5026c86fff3155c289
0mq 0.1.0,0.1.1,0.1.2,0.2.0,0.2.1,0.3.0,0.4.0,0.4.1,0.5.0,0.5.1,0.5.2,0.5.3 6146193f8f7e944156b0b42ec37bad3e
0xffffff 0.0.1,0.1.0 0a4a9aeae24152cdb467be02f40482f9
10to1-crack 0.1.1,0.1.2,0.1.3 e7218e76477e2137355d2e7ded094925
1234567890_ 1.0,1.1 233e818c2db65d2dad9f9ea9a27b1a30
12_hour_time 0.0.2,0.0.3,0.0.4 4e58bc03e301f704950410b713c20b69
16watts-fluently 0.3.0,0.3.1 555088e2b18e97e0293cab1d90dbb0d2
189seg 0.0.1 c4d329f7d3eb88b6e602358968be0242
196demo 0.0.0 e00c558565f7b03a438fbd93d854b7de
1_as_identity_function 1.0.0,1.0.1 bee2f0fbbc3c5c83008c0b8fc64cb168
1and1 1.1 1853e4495b036ddc5da2035523d48f0d
1hdoc 0.1.3,0.2.0,0.2.2,0.2.3,0.2.4 7076f29c196df12047a3700c4d6e5915
1pass 0.1.0,0.1.1,0.1.2 d209547aae4b8f3d67123f18f738ac99
1pass -0.1.2 abcdef
21-day-challenge-countdown 0.1.0,0.1.1,0.1.2 57e8873fe713063f4e54e85bbbd709bb`;

jest.mock('../../../lib/util/got');

describe('datasource/rubygems', () => {
  describe('getPkgReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const params = {
      lookupName: 'rails',
      registryUrls: ['https://thirdparty.com', 'https://firstparty.com'],
    };

    beforeEach(() => {
      process.env.RENOVATE_SKIP_CACHE = 'true';
      jest.resetAllMocks();
    });

    it('returns null for missing pkg', async () => {
      got.mockReturnValueOnce({});
      expect(await rubygems.getPkgReleases(params)).toBeNull();
    });

    it('returns null for rubygems.org package miss', async () => {
      const newparams = { ...params };
      newparams.registryUrls = ['https://rubygems.org'];
      got.mockReturnValueOnce({ body: rubygemsOrgVersions });
      expect(await rubygems.getPkgReleases(newparams)).toBeNull();
    });

    it('returns a dep for rubygems.org package hit', async () => {
      const newparams = {
        lookupName: '1pass',
        registryUrls: ['https://rubygems.org'],
      };
      got.mockReturnValueOnce({ body: rubygemsOrgVersions });
      const res = await rubygems.getPkgReleases(newparams);
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(
        res.releases.find(release => release.version === '0.1.1')
      ).toBeDefined();
      expect(
        res.releases.find(release => release.version === '0.1.2')
      ).toBeUndefined();
    });

    it('uses rubygems.org if no registry urls were provided', async () => {
      got.mockReturnValue({ body: rubygemsOrgVersions });

      expect(
        await rubygems.getPkgReleases({
          ...params,
          registryUrls: [],
        })
      ).toBeNull();

      const res = await rubygems.getPkgReleases({
        lookupName: '1pass',
        registryUrls: [],
      });
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });

    it('works with real data', async () => {
      got
        .mockReturnValueOnce({ body: railsInfo })
        .mockReturnValueOnce({ body: railsVersions });

      expect(await rubygems.getPkgReleases(params)).toMatchSnapshot();
    });

    it('uses multiple source urls', async () => {
      got
        .mockImplementationOnce(() =>
          Promise.reject({
            statusCode: 404,
          })
        )
        .mockImplementationOnce(() => ({ body: railsInfo }))
        .mockImplementationOnce(() => ({ body: railsVersions }));

      expect(await rubygems.getPkgReleases(params)).toMatchSnapshot();
    });

    it('returns null if mismatched name', async () => {
      got.mockReturnValueOnce({ body: { ...railsInfo, name: 'oooops' } });
      expect(await rubygems.getPkgReleases(params)).toBeNull();
    });

    afterEach(() => {
      global.repoCache = {};
      process.env.RENOVATE_SKIP_CACHE = SKIP_CACHE;
    });
  });
});
