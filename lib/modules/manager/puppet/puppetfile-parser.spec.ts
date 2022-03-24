import { Fixtures } from '../../../../test/fixtures';
import { parsePuppetfile } from './puppetfile-parser';

const puppetLabsRegistryUrl = 'https://forgeapi.puppetlabs.com';

describe('modules/manager/puppet/puppetfile-parser', () => {
  describe('parsePuppetfile()', () => {
    it('Puppetfile_git_tag', () => {
      const puppetfile = parsePuppetfile(Fixtures.get('Puppetfile_git_tag'));
      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toHaveLength(2);
      expect(defaultRegistryModules[0].name).toBe('apache');
      expect(defaultRegistryModules[0].version).toBeUndefined();
      expect(defaultRegistryModules[0].tags.get('git')).toBe(
        'https://github.com/puppetlabs/puppetlabs-apache'
      );
      expect(defaultRegistryModules[0].tags.get('tag')).toBe('0.9.0');

      expect(defaultRegistryModules[1].name).toBe('stdlib');
      expect(defaultRegistryModules[1].version).toBeUndefined();
      expect(defaultRegistryModules[1].tags.get('git')).toBe(
        'git@github.com:puppetlabs/puppetlabs-stdlib.git'
      );
      expect(defaultRegistryModules[1].tags.get('tag')).toBe('5.0.0');
    });

    it('Puppetfile_git_tag_single_line', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_git_tag_single_line')
      );
      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toHaveLength(2);
      expect(defaultRegistryModules[0].name).toBe('apache');
      expect(defaultRegistryModules[0].version).toBeUndefined();
      expect(defaultRegistryModules[0].tags.get('git')).toBe(
        'https://github.com/puppetlabs/puppetlabs-apache'
      );
      expect(defaultRegistryModules[0].tags.get('tag')).toBe('0.9.0');

      expect(defaultRegistryModules[1].name).toBe('stdlib');
      expect(defaultRegistryModules[1].version).toBeUndefined();
      expect(defaultRegistryModules[1].tags.get('git')).toBe(
        'git@github.com:puppetlabs/puppetlabs-stdlib.git'
      );
      expect(defaultRegistryModules[1].tags.get('tag')).toBe('5.0.0');
    });

    it('Puppetfile_invalid_module', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_invalid_module')
      );
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toHaveLength(1);
      expect(defaultRegistryModules[0].name).toBe('puppetlabs/stdlib');
      expect(defaultRegistryModules[0].version).toBe('8.0.0');
      expect(defaultRegistryModules[0].skipReason).toBeDefined();
      expect(defaultRegistryModules[0].skipReason).toBe('invalid-config');
    });

    it('Puppetfile_multiple_forges', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_multiple_forges')
      );
      expect(puppetfile.size).toBe(2);

      const defaultRegistryModules = puppetfile.get(puppetLabsRegistryUrl);

      expect(defaultRegistryModules).toHaveLength(3);
      expect(defaultRegistryModules[0].name).toBe('puppetlabs/stdlib');
      expect(defaultRegistryModules[0].version).toBe('8.0.0');
      expect(defaultRegistryModules[1].name).toBe('puppetlabs/apache');
      expect(defaultRegistryModules[1].version).toBe('6.5.1');
      expect(defaultRegistryModules[2].name).toBe('puppetlabs/puppetdb');
      expect(defaultRegistryModules[2].version).toBe('7.9.0');

      const someOtherPuppetForgeModules = puppetfile.get(
        'https://some-other-puppet-forge.com'
      );

      expect(someOtherPuppetForgeModules).toHaveLength(3);
      expect(someOtherPuppetForgeModules[0].name).toBe('mock/mockstdlib');
      expect(someOtherPuppetForgeModules[0].version).toBe('10.0.0');
      expect(someOtherPuppetForgeModules[1].name).toBe('mock/mockapache');
      expect(someOtherPuppetForgeModules[1].version).toBe('2.5.1');
      expect(someOtherPuppetForgeModules[2].name).toBe('mock/mockpuppetdb');
      expect(someOtherPuppetForgeModules[2].version).toBe('1.9.0');
    });

    it('Puppetfile_no_forge', () => {
      const puppetfile = parsePuppetfile(Fixtures.get('Puppetfile_no_forge'));
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(undefined);

      expect(defaultRegistryModules).toHaveLength(3);
      expect(defaultRegistryModules[0].name).toBe('puppetlabs/stdlib');
      expect(defaultRegistryModules[0].version).toBe('8.0.0');
      expect(defaultRegistryModules[1].name).toBe('puppetlabs/apache');
      expect(defaultRegistryModules[1].version).toBe('6.5.1');
      expect(defaultRegistryModules[2].name).toBe('puppetlabs/puppetdb');
      expect(defaultRegistryModules[2].version).toBe('7.9.0');
    });

    it('Puppetfile_single_forge', () => {
      const puppetfile = parsePuppetfile(
        Fixtures.get('Puppetfile_single_forge')
      );
      expect(puppetfile.size).toBe(1);

      const defaultRegistryModules = puppetfile.get(puppetLabsRegistryUrl);

      expect(defaultRegistryModules).toHaveLength(3);
      expect(defaultRegistryModules[0].name).toBe('puppetlabs/stdlib');
      expect(defaultRegistryModules[0].version).toBe('8.0.0');
      expect(defaultRegistryModules[1].name).toBe('puppetlabs/apache');
      expect(defaultRegistryModules[1].version).toBe('6.5.1');
      expect(defaultRegistryModules[2].name).toBe('puppetlabs/puppetdb');
      expect(defaultRegistryModules[2].version).toBe('7.9.0');
    });
  });
});
