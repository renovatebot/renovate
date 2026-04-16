import { Fixtures } from '~test/fixtures.ts';
import { BazelModuleMetadata, BcrPageData } from './schema.ts';

describe('modules/datasource/bazel/schema', () => {
  describe('BazelModuleMetadata', () => {
    it('parses metadata', () => {
      const metadataJson = Fixtures.get('metadata-with-yanked-versions.json');
      const metadata = BazelModuleMetadata.parse(JSON.parse(metadataJson));
      expect(metadata.versions).toHaveLength(4);
    });
  });

  describe('BcrPageData', () => {
    it('parses page data with version timestamps', () => {
      const pageData = BcrPageData.parse({
        props: {
          pageProps: {
            versionInfos: [
              {
                version: '0.14.8',
                submission: { authorDateIso: '2024-01-10T12:00:00Z' },
              },
              {
                version: '0.14.9',
                submission: { authorDateIso: '2024-03-15T14:30:00Z' },
              },
            ],
          },
        },
      });
      expect(pageData.props.pageProps.versionInfos).toHaveLength(2);
      expect(pageData.props.pageProps.versionInfos[0]).toMatchObject({
        version: '0.14.8',
        submission: {
          authorDateIso: '2024-01-10T12:00:00.000Z',
        },
      });
    });

    it('handles missing versionInfos gracefully', () => {
      const pageData = BcrPageData.parse({
        props: { pageProps: { versionInfos: [] } },
      });
      expect(pageData.props.pageProps.versionInfos).toHaveLength(0);
    });

    it('handles invalid timestamps gracefully', () => {
      const pageData = BcrPageData.parse({
        props: {
          pageProps: {
            versionInfos: [
              {
                version: '1.0.0',
                submission: { authorDateIso: 'not-a-date' },
              },
            ],
          },
        },
      });
      expect(
        pageData.props.pageProps.versionInfos[0].submission.authorDateIso,
      ).toBeNull();
    });
  });
});
