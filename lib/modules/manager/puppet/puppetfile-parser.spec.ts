import { EOL } from 'node:os';
import { Fixtures } from '../../../../test/fixtures';
import { parsePuppetfile } from './puppetfile-parser';

const puppetLabsRegistryUrl = 'https://forgeapi.puppetlabs.com';

describe('modules/manager/puppet/puppetfile-parser', () => {
  describe('parsePuppetfile()', () => {
    it('Puppetfile_github_tag', () => {
      const puppetfile = parsePuppetfile(Fixtures.get('Puppetfile.github_tag'));
      const defaultRegistryModules = puppetfile.getModulesOfForge(undefined);

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
        [
          "mod 'apache', :git => 'https://github.com/puppetlabs/puppetlabs-apache', :tag => '0.9.0'",
          "mod 'stdlib', :git => 'git@github.com:puppetlabs/puppetlabs-stdlib.git', :tag => '5.0.0'",
        ].join(EOL),
      );
      const defaultRegistryModules = puppetfile.getModulesOfForge(undefined);

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

    it('Puppetfile with an invalid module creates PuppetfileModule with skipReason "invalid-config"', () => {
      const puppetFileContent = `mod 'puppetlabs/stdlib', '8.0.0', 'i should trigger a skip reason'`;
      const puppetfile = parsePuppetfile(puppetFileContent);
      expect(puppetfile.getForges()).toHaveLength(1);

      const defaultRegistryModules = puppetfile.getModulesOfForge(undefined);

      expect(defaultRegistryModules).toEqual([
        {
          name: 'puppetlabs/stdlib',
          version: '8.0.0',
          skipReason: 'invalid-config',
        },
      ]);
    });

    it('get default forge with null or undefined returns the same', () => {
      const puppetFileContent = `mod 'puppetlabs/stdlib', '8.0.0', 'i should trigger a skip reason'`;
      const puppetfile = parsePuppetfile(puppetFileContent);
      expect(puppetfile.getForges()).toHaveLength(1);

      const defaultRegistryModulesUndefined =
        puppetfile.getModulesOfForge(undefined);
      const defaultRegistryModulesNull = puppetfile.getModulesOfForge(null);

      expect(defaultRegistryModulesUndefined).toEqual(
        defaultRegistryModulesNull,
      );
    });

    it('Puppetfile_multiple_forges', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile.multiple_forges'),
      );
      expect(puppetfile.getForges()).toHaveLength(2);

      const defaultRegistryModules = puppetfile.getModulesOfForge(
        puppetLabsRegistryUrl,
      );

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

      const someOtherPuppetForgeModules = puppetfile.getModulesOfForge(
        'https://some-other-puppet-forge.com',
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
      const puppetfile = parsePuppetfile(
        [
          "mod 'puppetlabs/stdlib', '8.0.0'",
          "mod 'puppetlabs/apache', '6.5.1'",
          "mod 'puppetlabs/puppetdb', '7.9.0'",
        ].join(EOL),
      );
      expect(puppetfile.getForges()).toHaveLength(1);

      const defaultRegistryModules = puppetfile.getModulesOfForge(undefined);

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
        [
          'forge "https://forgeapi.puppetlabs.com"',
          "mod 'puppetlabs/stdlib', '8.0.0'",
          "mod 'puppetlabs/apache', '6.5.1'",
          "mod 'puppetlabs/puppetdb', '7.9.0'",
        ].join(EOL),
      );
      expect(puppetfile.getForges()).toHaveLength(1);

      const defaultRegistryModules = puppetfile.getModulesOfForge(
        puppetLabsRegistryUrl,
      );

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
        Fixtures.get('Puppetfile.with_comments'),
      );
      expect(puppetfile.getForges()).toHaveLength(1);

      const defaultRegistryModules = puppetfile.getModulesOfForge(undefined);

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
