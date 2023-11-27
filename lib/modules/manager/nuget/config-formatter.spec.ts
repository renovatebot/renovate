import { XmlDocument } from 'xmldoc';
import * as hostRules from '../../../util/host-rules';
import { createNuGetConfigXml } from './config-formatter';
import type { Registry } from './types';

describe('modules/manager/nuget/config-formatter', () => {
  describe('createNuGetConfigXml', () => {
    beforeEach(() => {
      hostRules.clear();
    });

    it('returns xml with registries', () => {
      const registries: Registry[] = [
        {
          name: 'myRegistry',
          url: 'https://my-registry.example.org',
        },
        {
          name: 'myRegistry2',
          url: 'https://my-registry2.example.org/index.json',
        },
        {
          url: 'https://my-unnamed-registry.example.org/index.json',
        },
      ];

      const xml = createNuGetConfigXml(registries);
      const xmlDocument = new XmlDocument(xml);
      const packageSources = xmlDocument.childNamed('packageSources');
      expect(packageSources).toBeDefined();

      const myRegistry = packageSources?.childWithAttribute(
        'key',
        'myRegistry',
      );
      expect(myRegistry?.name).toBe('add');
      expect(myRegistry?.attr['value']).toBe(
        'https://my-registry.example.org/',
      );
      expect(myRegistry?.attr['protocolVersion']).toBe('2');

      const myRegistry2 = packageSources?.childWithAttribute(
        'key',
        'myRegistry2',
      );
      expect(myRegistry2?.name).toBe('add');
      expect(myRegistry2?.attr['value']).toBe(
        'https://my-registry2.example.org/index.json',
      );
      expect(myRegistry2?.attr['protocolVersion']).toBe('3');

      const myUnnamedRegistry = packageSources?.childWithAttribute(
        'value',
        'https://my-unnamed-registry.example.org/index.json',
      );
      expect(myUnnamedRegistry?.name).toBe('add');
      expect(myUnnamedRegistry?.attr['key']).toBe('Package source 1');
    });

    it('returns xml with authenticated registries', () => {
      hostRules.add({
        hostType: 'nuget',
        matchHost: 'my-registry.example.org',
        username: 'some-username',
        password: 'some-password',
      });
      hostRules.add({
        hostType: 'nuget',
        matchHost: 'my-registry2.example.org',
        password: 'some-password',
      });

      const registries: Registry[] = [
        {
          name: 'myRegistry',
          url: 'https://my-registry.example.org',
        },
        {
          name: 'myRegistry2',
          url: 'https://my-registry2.example.org',
        },
      ];

      const xml = createNuGetConfigXml(registries);
      const xmlDocument = new XmlDocument(xml);
      const packageSources = xmlDocument.childNamed('packageSources');
      expect(packageSources).toBeDefined();

      const myRegistry = packageSources?.childWithAttribute(
        'key',
        'myRegistry',
      );
      expect(myRegistry?.name).toBe('add');

      const myRegistry2 = packageSources?.childWithAttribute(
        'key',
        'myRegistry2',
      );
      expect(myRegistry2?.name).toBe('add');

      const myRegistryCredentials = xmlDocument.descendantWithPath(
        'packageSourceCredentials.myRegistry',
      );
      expect(
        myRegistryCredentials?.childWithAttribute('key', 'Username')?.attr[
          'value'
        ],
      ).toBe('some-username');

      expect(
        myRegistryCredentials?.childWithAttribute('key', 'ClearTextPassword')
          ?.attr['value'],
      ).toBe('some-password');

      expect(
        myRegistryCredentials?.childWithAttribute(
          'key',
          'ValidAuthenticationTypes',
        )?.attr['value'],
      ).toBe('basic');

      const myRegistry2Credentials = xmlDocument.descendantWithPath(
        'packageSourceCredentials.myRegistry2',
      );
      expect(
        myRegistry2Credentials?.childWithAttribute('key', 'Username'),
      ).toBeUndefined();
      expect(
        myRegistry2Credentials?.childWithAttribute('key', 'ClearTextPassword')
          ?.attr['value'],
      ).toBe('some-password');

      expect(
        myRegistry2Credentials?.childWithAttribute(
          'key',
          'ValidAuthenticationTypes',
        )?.attr['value'],
      ).toBe('basic');
    });

    it('escapes registry credential names containing special characters', () => {
      hostRules.add({
        hostType: 'nuget',
        matchHost: 'my-registry.example.org',
        username: 'some-username',
        password: 'some-password',
      });

      const registries: Registry[] = [
        {
          name: 'my very? weird!-regi$try_name',
          url: 'https://my-registry.example.org',
        },
      ];

      const xml = createNuGetConfigXml(registries);
      const xmlDocument = new XmlDocument(xml);

      const packageSourceCredentials = xmlDocument.childNamed(
        'packageSourceCredentials',
      );
      expect(packageSourceCredentials).toBeDefined();

      const registryCredentialsWithSpecialName =
        packageSourceCredentials?.childNamed(
          'my__x0020__very__x003f____x0020__weird__x0021__-regi__x0024__try_name',
        );

      expect(
        registryCredentialsWithSpecialName?.childWithAttribute(
          'key',
          'Username',
        )?.attr['value'],
      ).toBe('some-username');

      expect(
        registryCredentialsWithSpecialName?.childWithAttribute(
          'key',
          'ClearTextPassword',
        )?.attr['value'],
      ).toBe('some-password');
    });

    it('strips protocol version from feed url', () => {
      const registries: Registry[] = [
        {
          name: 'myRegistry',
          url: 'https://my-registry.example.org#protocolVersion=3',
        },
      ];

      const xml = createNuGetConfigXml(registries);
      const xmlDocument = new XmlDocument(xml);
      const packageSources = xmlDocument.childNamed('packageSources');
      expect(packageSources).toBeDefined();

      const myRegistry = packageSources?.childWithAttribute(
        'key',
        'myRegistry',
      );
      expect(myRegistry?.attr['value']).toBe(
        'https://my-registry.example.org/',
      );
      expect(myRegistry?.attr['protocolVersion']).toBe('3');
    });

    it('includes packageSourceMapping when defined', () => {
      const registries: Registry[] = [
        {
          name: 'myRegistry',
          url: 'https://my-registry.example.org',
          sourceMappedPackagePatterns: ['*'],
        },
        {
          name: 'myRegistry2',
          url: 'https://my-registry2.example.org/index.json',
          sourceMappedPackagePatterns: [
            'LimitedPackages.*',
            'MySpecialPackage',
          ],
        },
      ];

      const xml = createNuGetConfigXml(registries);
      const xmlDocument = new XmlDocument(xml);
      const packageSourceMapping = xmlDocument.childNamed(
        'packageSourceMapping',
      );
      expect(packageSourceMapping).toBeDefined();

      const myRegistryMaps = packageSourceMapping?.childWithAttribute(
        'key',
        'myRegistry',
      );
      expect(myRegistryMaps?.name).toBe('packageSource');
      expect(myRegistryMaps?.childNamed('package')?.attr['pattern']).toBe('*');

      const myRegistry2Maps = packageSourceMapping?.childWithAttribute(
        'key',
        'myRegistry2',
      );
      expect(myRegistry2Maps?.name).toBe('packageSource');
      expect(
        myRegistry2Maps
          ?.childrenNamed('package')
          .map((child) => child.attr['pattern']),
      ).toEqual(['LimitedPackages.*', 'MySpecialPackage']);
    });

    it('excludes packageSourceMapping when undefined', () => {
      const registries: Registry[] = [
        {
          name: 'myRegistry',
          url: 'https://my-registry.example.org',
        },
        {
          name: 'myRegistry2',
          url: 'https://my-registry2.example.org/index.json',
        },
      ];

      const xml = createNuGetConfigXml(registries);
      const xmlDocument = new XmlDocument(xml);
      const packageSourceMapping = xmlDocument.childNamed(
        'packageSourceMapping',
      );
      expect(packageSourceMapping).toBeUndefined();
    });
  });
});
