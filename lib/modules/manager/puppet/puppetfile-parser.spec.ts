import { Fixtures } from '../../../../test/fixtures';
import { parsePuppetfile } from './puppetfile-parser';

const puppetLabsRegistryUrl = 'https://forgeapi.puppetlabs.com';

describe('modules/manager/puppet/puppetfile-parser', () => {
  describe('parsePuppetfile()', () => {
    it('Puppetfile_github_tag', () => {
      const puppetfile = parsePuppetfile(Fixtures.get('Puppetfile_github_tag'));
      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'apache',
          tags: new Map([
            ['git', 'https://github.com/puppetlabs/puppetlabs-apache'],
            ['tag', '0.9.0'],
          ]),
        },
        {
          name: 'stdlib',
          tags: new Map([
            ['git', 'git@github.com:puppetlabs/puppetlabs-stdlib.git'],
            ['tag', '5.0.0'],
          ]),
        },
      ]);
    });

    it('Puppetfile_github_tag_single_line', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_github_tag_single_line')
      );
      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'apache',
          tags: new Map([
            ['git', 'https://github.com/puppetlabs/puppetlabs-apache'],
            ['tag', '0.9.0'],
          ]),
        },
        {
          name: 'stdlib',
          tags: new Map([
            ['git', 'git@github.com:puppetlabs/puppetlabs-stdlib.git'],
            ['tag', '5.0.0'],
          ]),
        },
      ]);
    });

    it('Puppetfile_invalid_module', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_invalid_module')
      );
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'puppetlabs/stdlib',
          version: '8.0.0',
          skipReason: 'invalid-config',
        },
      ]);
    });

    it('Puppetfile_multiple_forges', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_multiple_forges')
      );
      expect(puppetfile.size).toBe(2);

      const defaultRegistryModules = puppetfile.get(puppetLabsRegistryUrl);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'puppetlabs/stdlib',
          version: '8.0.0',
        },
        {
          name: 'puppetlabs/apache',
          version: '6.5.1',
        },
        {
          name: 'puppetlabs/puppetdb',
          version: '7.9.0',
        },
      ]);

      const someOtherPuppetForgeModules = puppetfile.get(
        'https://some-other-puppet-forge.com'
      );

      expect(someOtherPuppetForgeModules).toEqual([
        {
          name: 'mock/mockstdlib',
          version: '10.0.0',
        },
        {
          name: 'mock/mockapache',
          version: '2.5.1',
        },
        {
          name: 'mock/mockpuppetdb',
          version: '1.9.0',
        },
      ]);
    });

    it('Puppetfile_no_forge', () => {
      const puppetfile = parsePuppetfile(Fixtures.get('Puppetfile_no_forge'));
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'puppetlabs/stdlib',
          version: '8.0.0',
        },
        {
          name: 'puppetlabs/apache',
          version: '6.5.1',
        },
        {
          name: 'puppetlabs/puppetdb',
          version: '7.9.0',
        },
      ]);
    });

    it('Puppetfile_single_forge', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_single_forge')
      );
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(puppetLabsRegistryUrl);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'puppetlabs/stdlib',
          version: '8.0.0',
        },
        {
          name: 'puppetlabs/apache',
          version: '6.5.1',
        },
        {
          name: 'puppetlabs/puppetdb',
          version: '7.9.0',
        },
      ]);
    });

    it('Puppetfile_with_comments', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_with_comments')
      );
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'puppetlabs/stdlib',
          version: '8.0.0',
        },
        {
          name: 'puppetlabs/apache',
          version: '6.5.1',
        },
        {
          name: 'apache',
          tags: new Map([
            ['git', 'https://github.com/puppetlabs/puppetlabs-apache'],
          ]),
        },
        {
          name: 'stdlib',
          tags: new Map([['tag', '5.0.0']]),
        },
        {
          name: 'stdlib2',
          tags: new Map([
            ['git', 'git@github.com:puppetlabs/puppetlabs-stdlib2.git'],
          ]),
        },
      ]);
    });
  });
});
