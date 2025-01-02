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
    const expected = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: 19.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(expected);
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
    const expected = yamlCodeBlock`
      packages:
        - pkg-a

      catalogs:
        default:
          react: 19.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(expected);
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
    const expected = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        react: 18.3.1

      catalogs:
        react17:
          react: 19.0.0

    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(expected);
  });

  it.failing('replaces package', () => {
    const upgrade = {
      depType: 'pnpm.catalog',
      depName: 'config',
      newName: 'abc',
      newValue: '2.0.0',
    };
    const pnpmWorkspaceYaml = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        config: 1.21.0
    `;
    const expected = yamlCodeBlock`
      packages:
        - pkg-a

      catalog:
        abc: 2.0.0
    `;
    const testContent = npmUpdater.updateDependency({
      fileContent: pnpmWorkspaceYaml,
      upgrade,
    });
    expect(testContent).toEqual(expected);
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
});
