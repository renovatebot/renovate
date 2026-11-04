import { PuppetModule, PuppetReleaseAbbreviated } from './schema.ts';

describe('modules/datasource/puppet-forge/schema', () => {
  describe('PuppetReleaseAbbreviatedSchema', () => {
    it('maps file_uri and created_at when present', () => {
      const result = PuppetReleaseAbbreviated.parse({
        version: '1.0.0',
        created_at: '2021-10-11 07:47:24 -0700',
        file_uri: '/v3/files/puppetlabs-apache-1.0.0.tar.gz',
      });
      expect(result).toEqual({
        version: '1.0.0',
        downloadUrl: '/v3/files/puppetlabs-apache-1.0.0.tar.gz',
        releaseTimestamp: '2021-10-11T14:47:24.000Z',
      });
    });

    it('omits download and timestamp when file_uri and created_at are null', () => {
      const result = PuppetReleaseAbbreviated.parse({
        version: '1.0.0',
        created_at: null,
        deleted_at: null,
        file_uri: null,
      });
      expect(result).toEqual({ version: '1.0.0' });
    });

    it('returns null for deleted releases', () => {
      const result = PuppetReleaseAbbreviated.parse({
        version: '1.0.0',
        created_at: '2021-10-11 07:47:24 -0700',
        deleted_at: '2021-10-12 07:47:24 -0700',
        file_uri: '/v3/files/puppetlabs-apache-1.0.0.tar.gz',
      });
      expect(result).toBeNull();
    });
  });

  describe('PuppetModuleSchema', () => {
    it('maps homepage and deprecation message when present', () => {
      const result = PuppetModule.parse({
        releases: [
          { version: '2.0.0', deleted_at: '2021-10-12 07:47:24 -0700' },
          { version: '1.0.0', deleted_at: null },
        ],
        homepage_url: 'https://github.com/puppetlabs/puppetlabs-apache',
        deprecated_for: 'use another module ...',
      });
      expect(result).toEqual({
        releases: [{ version: '1.0.0' }],
        homepage: 'https://github.com/puppetlabs/puppetlabs-apache',
        deprecationMessage: 'use another module ...',
      });
    });

    it('omits homepage and deprecation message when null and defaults releases', () => {
      const result = PuppetModule.parse({
        homepage_url: null,
        deprecated_for: null,
      });
      expect(result).toEqual({ releases: [] });
    });
  });
});
