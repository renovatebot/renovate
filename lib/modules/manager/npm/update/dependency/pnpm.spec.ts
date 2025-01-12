import { codeBlock } from 'common-tags';
import * as npmUpdater from '../..';

/**
 * Per the YAML spec, a document ends with a newline. The 'yaml' library always
 * uses that when serialising, but `codeBlock` strips the last indentation. This
 * helper makes assertions simpler.
 */
function yamlCodeBlock(
  literals: TemplateStringsArray,
  ...placeholders: any[]
): string {
  return codeBlock(literals, placeholders) + '\n';
}

describe('modules/manager/npm/update/dependency/pnpm', () => {
  it('handles implicit default catalog dependency', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: 19.0.0
    `);
  });

  it('handles explicit default catalog dependency', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
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
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalogs:
        default:
          react: 19.0.0
    `);
  });

  it('handles explicit named catalog dependency', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'react17',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
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
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1

      catalogs:
        react17:
          react: 19.0.0

    `);
  });

  it('replaces package', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'config',
      newName: 'abc',
      newValue: '2.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        config: 1.21.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        abc: 2.0.0
    `);
  });

  it('replaces a github dependency value', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'gulp',
      currentValue: 'v4.0.0-alpha.2',
      currentRawValue: 'gulpjs/gulp#v4.0.0-alpha.2',
      newValue: 'v4.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#v4.0.0-alpha.2
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#v4.0.0
    `);
  });

  it('replaces a npm package alias', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'hapi',
      npmPackageAlias: true,
      packageName: '@hapi/hapi',
      currentValue: '18.3.0',
      newValue: '18.3.1',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        hapi: npm:@hapi/hapi@18.3.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        hapi: npm:@hapi/hapi@18.3.1
    `);
  });

  it('replaces a github short hash', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'gulp',
      currentDigest: 'abcdef7',
      currentRawValue: 'gulpjs/gulp#abcdef7',
      newDigest: '0000000000111111111122222222223333333333',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#abcdef7
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        gulp: gulpjs/gulp#0000000
    `);
  });

  it('replaces a github fully specified version', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'n',
      currentValue: 'v1.0.0',
      currentRawValue: 'git+https://github.com/owner/n#v1.0.0',
      newValue: 'v1.1.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        n: git+https://github.com/owner/n#v1.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        n: git+https://github.com/owner/n#v1.1.0
    `);
  });

  it('returns null if the dependency is not present in the target catalog', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react-not',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
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
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
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
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const testContent = npmUpdater.updateDependency({
      fileContent: null as never,
      upgrade,
    });
    expect(testContent).toBeNull();
  });

  it('preserves formatting in flow style syntax', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'react17',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalogs: {
        react17: {
          react: 18.3.1
        }
      }
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalogs: {
        react17: {
          react: 19.0.0
        }
      }
    `);
  });

  it('preserves literal whitespace', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react:    18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react:    19.0.0
    `);
  });

  it('preserves single quote style', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: '18.3.1'
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: '19.0.0'
    `);
  });

  it('preserves double quote style', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: "18.3.1"
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: "19.0.0"
    `);
  });

  it('preserves anchors, replacing only the value', () => {
    // At the time of writing, this pattern is the current way to sync
    // dependencies in catalogs.
    // @see https://github.com/pnpm/pnpm/issues/8245#issuecomment-2371335323
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
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
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react 19.0.0
        react-dom: *react
    `);
  });

  it('preserves whitespace with anchors', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react    18.3.1
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react    19.0.0
    `);
  });

  it('preserves quotation style with anchors', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react "18.3.1"
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: &react "19.0.0"
    `);
  });

  it('does not replace aliases', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'react',
      newValue: '19.0.0',
      managerData: {
        catalogName: 'default',
      },
    };
    // In the general case, we do not know whether we should replace the anchor
    // that an alias is resolved from. We leave this up to the user, e.g. via a
    // Regex custom manager.
    const pnpmWorkspaceYaml = yamlCodeBlock`
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
});
