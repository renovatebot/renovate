import { codeBlock } from 'common-tags';
import * as npmUpdater from '../..';
import { updateYarnrcCatalogDependency } from './yarn';
import { logger } from '~test/util';

describe('modules/manager/npm/update/dependency/yarn', () => {
  describe('updateYarnrcCatalogDependency', () => {
    it('returns null if catalogName is missing and logs error', () => {
      const upgrade = {
        depType: undefined,
        depName: 'react',
        newValue: '19.0.0',
      };

      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 18.3.1
    `;
      const testContent = updateYarnrcCatalogDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });

      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.logger.error).toHaveBeenCalledWith(
        'No catalogName was found; this is likely an extraction error.',
      );
      expect(testContent).toBeNull();
    });

    it('ensure continuation even if catalog list and update does not match', () => {
      const upgrade = {
        depType: 'yarn.catalog.react17',
        depName: 'react',
        newValue: '19.0.0',
      };

      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react18:
            react: 18.3.1
    `;
      const testContent = updateYarnrcCatalogDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toBeNull();
    });

    it('ensure continuation even if dependency and update does not match', () => {
      const upgrade = {
        depType: 'yarn.catalog.react18',
        depName: 'react',
        newValue: '19.0.0',
      };

      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react18:
            react-dom: 18.3.1
    `;

      const testContent = updateYarnrcCatalogDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toBeNull();
    });

    it('ensure trace logging', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };

      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 18.3.1
    `;
      updateYarnrcCatalogDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });

      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.logger.trace).toHaveBeenCalledWith(
        'npm.updateYarnrcCatalogDependency(): yarn.catalog.default::default.react = 19.0.0',
      );
    });
  });
  describe('updateDependency', () => {
    it(`returns null if catalogName is missing`, () => {
      const upgrade = {
        depName: 'react',
        newValue: '19.0.0',
      };

      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 18.3.1
    `;

      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });

      expect(testContent).toBeNull();
    });

    it('handles implicit default catalog dependency', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 18.3.1
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 19.0.0
    `);
    });

    it('handles explicit named catalog dependency', () => {
      const upgrade = {
        depType: 'yarn.catalog.react17',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react17:
            react: 17.0.0
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react17:
            react: 19.0.0
    `);
    });

    it('does nothing if the new and old values match', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 19.0.0
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(yarnrcYaml);
    });

    it('replaces package', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'config',
        newName: 'abc',
        newValue: '2.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          config: 1.21.0
    `;

      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          abc: 2.0.0
    `);
    });

    it('replaces a github dependency value', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'gulp',
        currentValue: 'v4.0.0-alpha.2',
        currentRawValue: 'gulpjs/gulp#v4.0.0-alpha.2',
        newValue: 'v4.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          gulp: gulpjs/gulp#v4.0.0-alpha.2
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          gulp: gulpjs/gulp#v4.0.0
    `);
    });

    it('replaces a npm package alias', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'hapi',
        npmPackageAlias: true,
        packageName: '@hapi/hapi',
        currentValue: '18.3.0',
        newValue: '18.3.1',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          hapi: npm:@hapi/hapi@18.3.0
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          hapi: npm:@hapi/hapi@18.3.1
    `);
    });

    it('replaces a github short hash', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'gulp',
        currentDigest: 'abcdef7',
        currentRawValue: 'gulpjs/gulp#abcdef7',
        newDigest: '0000000000111111111122222222223333333333',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          gulp: gulpjs/gulp#abcdef7
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          gulp: gulpjs/gulp#0000000
    `);
    });

    it('replaces a github fully specified version', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'n',
        currentValue: 'v1.0.0',
        currentRawValue: 'git+https://github.com/owner/n#v1.0.0',
        newValue: 'v1.1.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          n: git+https://github.com/owner/n#v1.0.0
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          n: git+https://github.com/owner/n#v1.1.0
    `);
    });

    it('returns null if the dependency is not present in the target catalog', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react-not',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:

      catalog:
        react: 18.3.1
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toBeNull();
    });

    it('returns null if catalogs are missing', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toBeNull();
    });

    it('returns null if empty file', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const testContent = npmUpdater.updateDependency({
        fileContent: null as never,
        upgrade,
      });
      expect(testContent).toBeNull();
    });

    it('preserves literal whitespace', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react:    18.3.1

    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react:    19.0.0
    `);
    });

    it('preserves single quote style', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: '18.3.1'
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: '19.0.0'
    `);
    });

    it('preserves comments', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 18.3.1 # This is a comment
          # This is another comment
          react-dom: 18.3.1
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: 19.0.0 # This is a comment
          # This is another comment
          react-dom: 18.3.1
    `);
    });

    it('preserves double quote style', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: "18.3.1"
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: "19.0.0"
    `);
    });

    it('preserves anchors, replacing only the value', () => {
      // At the time of writing, this pattern is the recommended way to sync
      // dependencies in catalogs.
      // @see https://github.com/pnpm/pnpm/issues/8245#issuecomment-2371335323
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: &react 18.3.1
          react-dom: *react
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: &react 19.0.0
          react-dom: *react
    `);
    });

    it('preserves whitespace with anchors', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: &react    18.3.1
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: &react    19.0.0
    `);
    });

    it('preserves quotation style with anchors', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: &react "18.3.1"
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
       nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: &react "19.0.0"
    `);
    });

    it('preserves formatting in flow style syntax', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      const yarnrcYaml = codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list: {
          # This is a comment
          "react": "18.3.1"
        }
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toEqual(codeBlock`
      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list: {
          # This is a comment
          "react": "19.0.0"
        }
    `);
    });

    it('does not replace aliases in the value position', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newValue: '19.0.0',
      };
      // In the general case, we do not know whether we should replace the anchor
      // that an alias is resolved from. We leave this up to the user, e.g. via a
      // Regex custom manager.
      const yarnrcYaml = codeBlock`
      __deps:
        react: &react 18.3.1

      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          react: *react
          react-dom: *react
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toBeNull();
    });

    it('does not replace aliases in the key position', () => {
      const upgrade = {
        depType: 'yarn.catalog.default',
        depName: 'react',
        newName: 'react-x',
      };
      const yarnrcYaml = codeBlock`
      __vars:
        &r react: ""

      nodeLinker: node-modules

      plugins:
        - checksum: 4cb9601cfc0c71e5b0ffd0a85b78e37430b62257040714c2558298ce1fc058f4e918903f0d1747a4fef3f58e15722c35bd76d27492d9d08aa5b04e235bf43b22
          path: .yarn/plugins/@yarnpkg/plugin-catalogs.cjs
          spec: 'https://raw.githubusercontent.com/toss/yarn-plugin-catalogs/main/bundles/%40yarnpkg/plugin-catalogs.js'

      catalogs:
        list:
          *r: 18.0.0
    `;
      const testContent = npmUpdater.updateDependency({
        fileContent: yarnrcYaml,
        upgrade,
      });
      expect(testContent).toBeNull();
    });
  });
});
