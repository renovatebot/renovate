import { codeBlock } from 'common-tags';
import * as npmUpdater from '../../index.ts';

describe('modules/manager/npm/update/dependency/pnpm', () => {
  it('handles implicit default catalog dependency', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 19.0.0
    `);
  });

  it('handles explicit default catalog dependency', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalogs:
        default:
          react: 18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalogs:
        default:
          react: 19.0.0
    `);
  });

  it('handles explicit named catalog dependency', () => {
    const upgrade = {
      depType: 'pnpm.catalog.react17',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1

      catalogs:
        react17:
          react: 17.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1

      catalogs:
        react17:
          react: 19.0.0

    `);
  });

  it('does nothing if the new and old values match', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 19.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(pnpmWorkspaceYaml);
  });

  it('replaces package', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'config',
      newName: 'abc',
      newValue: '2.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        config: 1.21.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        abc: 2.0.0
    `);
  });

  it('replaces a github dependency value', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'gulp',
      currentValue: 'v4.0.0-alpha.2',
      currentRawValue: 'gulpjs/gulp#v4.0.0-alpha.2',
      newValue: 'v4.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#v4.0.0-alpha.2
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#v4.0.0
    `);
  });

  it('replaces a npm package alias', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'hapi',
      npmPackageAlias: true,
      packageName: '@hapi/hapi',
      currentValue: '18.3.0',
      newValue: '18.3.1',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        hapi: npm:@hapi/hapi@18.3.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        hapi: npm:@hapi/hapi@18.3.1
    `);
  });

  it('replaces a github short hash', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'gulp',
      currentDigest: 'abcdef7',
      currentRawValue: 'gulpjs/gulp#abcdef7',
      newDigest: '0000000000111111111122222222223333333333',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#abcdef7
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#0000000
    `);
  });

  it('replaces a github fully specified version', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'n',
      currentValue: 'v1.0.0',
      currentRawValue: 'git+https://github.com/owner/n#v1.0.0',
      newValue: 'v1.1.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        n: git+https://github.com/owner/n#v1.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        n: git+https://github.com/owner/n#v1.1.0
    `);
  });

  it('returns null if the dependency is not present in the target catalog', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react-not',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('returns null if catalogs are missing', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('returns null if empty file', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
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
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react:    18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react:    19.0.0
    `);
  });

  it('preserves single quote style', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: '18.3.1'
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: '19.0.0'
    `);
  });

  it('preserves comments', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1 # This is a comment
        # This is another comment
        react-dom: 18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: 19.0.0 # This is a comment
        # This is another comment
        react-dom: 18.3.1
    `);
  });

  it('preserves double quote style', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: "18.3.1"
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: "19.0.0"
    `);
  });

  it('preserves anchors, replacing only the value', () => {
    // At the time of writing, this pattern is the recommended way to sync
    // dependencies in catalogs.
    // @see https://github.com/pnpm/pnpm/issues/8245#issuecomment-2371335323
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react 18.3.1
        react-dom: *react
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react 19.0.0
        react-dom: *react
    `);
  });

  it('preserves whitespace with anchors', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react    18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react    19.0.0
    `);
  });

  it('preserves quotation style with anchors', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react "18.3.1"
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react "19.0.0"
    `);
  });

  it('preserves formatting in flow style syntax', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a

      catalog: {
        # This is a comment
        "react": "18.3.1"
      }
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      packages:
        - pkg-a

      catalog: {
        # This is a comment
        "react": "19.0.0"
      }
    `);
  });

  it('does not replace aliases in the value position', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newValue: '19.0.0',
    };
    // In the general case, we do not know whether we should replace the anchor
    // that an alias is resolved from. We leave this up to the user, e.g. via a
    // Regex custom manager.
    const pnpmWorkspaceYaml = codeBlock`
      __deps:
        react: &react 18.3.1

      packages:
        - pkg-a

      catalog:
        react: *react
        react-dom: *react
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('does not replace aliases in the key position', () => {
    const upgrade = {
      depType: 'pnpm.catalog.default',
      depName: 'react',
      newName: 'react-x',
    };
    const pnpmWorkspaceYaml = codeBlock`
      __vars:
        &r react: ""

      packages:
        - pkg-a

      catalog:
        *r: 18.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('handles pnpm configDependencies (scalar)', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@pnpm/plugin-better-defaults',
      newValue: '0.2.2',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@pnpm/plugin-better-defaults': 0.2.1+sha512-abc
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      configDependencies:
        '@pnpm/plugin-better-defaults': 0.2.2
    `);
  });

  it('handles pnpm configDependencies (scalar) with newDigest', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@pnpm/plugin-better-defaults',
      newValue: '0.2.2',
      newDigest: 'sha512-def',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@pnpm/plugin-better-defaults': 0.2.1+sha512-abc
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      configDependencies:
        '@pnpm/plugin-better-defaults': 0.2.2+sha512-def
    `);
  });

  it('handles pnpm configDependencies (object)', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@myorg/pnpm-config-myorg',
      currentValue:
        '0.0.9+sha512-M2/VDjgxKrrY6lAo9rcCC1GE40uJBRHKFqvtdQTAdAPasr2MG0qfN/HeLByjd1bYiKWK2MWv0gDfUGGbs+DXDQ==',
      currentVersion: '0.0.9',
      newValue: '0.1.0',
      newVersion: '0.1.0',
      downloadUrl:
        'https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.1.0/0e6f2aea83935148ec1adfd3fd8c2afefd324516',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.0.9+sha512-M2/VDjgxKrrY6lAo9rcCC1GE40uJBRHKFqvtdQTAdAPasr2MG0qfN/HeLByjd1bYiKWK2MWv0gDfUGGbs+DXDQ==
          tarball: https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.0.9/0e6f2aea83935148ec1adfd3fd8c2afefd324516
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.1.0
          tarball: https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.1.0/0e6f2aea83935148ec1adfd3fd8c2afefd324516
    `);
  });

  it('handles pnpm configDependencies (object) with newDigest and downloadUrl', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@myorg/pnpm-config-myorg',
      currentValue:
        '0.0.9+sha512-M2/VDjgxKrrY6lAo9rcCC1GE40uJBRHKFqvtdQTAdAPasr2MG0qfN/HeLByjd1bYiKWK2MWv0gDfUGGbs+DXDQ==',
      currentVersion: '0.0.9',
      newValue: '0.1.0',
      newVersion: '0.1.0',
      newDigest: 'sha512-def',
      downloadUrl:
        'https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.1.0/new-hash',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.0.9+sha512-M2/VDjgxKrrY6lAo9rcCC1GE40uJBRHKFqvtdQTAdAPasr2MG0qfN/HeLByjd1bYiKWK2MWv0gDfUGGbs+DXDQ==
          tarball: https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.0.9/0e6f2aea83935148ec1adfd3fd8c2afefd324516
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.1.0+sha512-def
          tarball: https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.1.0/new-hash
    `);
  });

  it('returns null for missing configDependencies section', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: 'any',
      newValue: '1.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      packages:
        - pkg-a
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('returns null for missing dependency in configDependencies', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: 'missing',
      newValue: '1.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        existing: 1.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('returns null for invalid YAML', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: 'any',
      newValue: '1.0.0',
    };
    const pnpmWorkspaceYaml = 'invalid: [';
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('returns null for object update without downloadUrl', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@myorg/pnpm-config-myorg',
      currentVersion: '0.0.9',
      newValue: '0.1.0',
      newVersion: '0.1.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.0.9
          tarball: https://npm.pkg.github.com/download/@myorg/pnpm-config-myorg/0.0.9/hash
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('handles pnpm configDependencies (object) where integrity is an alias and tarball is scalar', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@myorg/pnpm-config-myorg',
      newValue: '0.1.0',
      downloadUrl: 'https://new-tarball',
    };
    const pnpmWorkspaceYaml = codeBlock`
      __vars:
        &int 0.0.9
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: *int
          tarball: https://old-tarball
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      __vars:
        &int 0.0.9
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: *int
          tarball: https://new-tarball
    `);
  });

  it('handles pnpm configDependencies (object) where integrity is scalar and tarball is an alias', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@myorg/pnpm-config-myorg',
      newValue: '0.1.0',
      downloadUrl: 'https://new-tarball',
    };
    const pnpmWorkspaceYaml = codeBlock`
      __vars:
        &tar https://old-tarball
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.0.9
          tarball: *tar
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      __vars:
        &tar https://old-tarball
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.1.0
          tarball: *tar
    `);
  });

  it('handles scalar update with newName', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: 'old-name',
      newName: 'new-name',
      newValue: '1.1.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        old-name: 1.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(codeBlock`
      configDependencies:
        new-name: 1.1.0
    `);
  });

  it('returns null if configDependencies is invalid structure', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@myorg/pnpm-config-myorg',
      newValue: '0.1.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@myorg/pnpm-config-myorg':
          integrity: 0.0.9
          # missing tarball which is required by schema
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('returns original content if version is already updated', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: '@pnpm/plugin-better-defaults',
      newValue: '0.2.1',
    };
    const pnpmWorkspaceYaml = codeBlock`
      configDependencies:
        '@pnpm/plugin-better-defaults': 0.2.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(pnpmWorkspaceYaml);
  });

  it('returns null if configDependencies value is an alias', () => {
    const upgrade = {
      depType: 'pnpm.configDependencies',
      depName: 'react',
      newValue: '19.0.0',
    };
    const pnpmWorkspaceYaml = codeBlock`
      __deps:
        react: &react 18.3.1
      configDependencies:
        react: *react
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toBeNull();
  });
});
