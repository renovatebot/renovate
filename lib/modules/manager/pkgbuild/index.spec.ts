import * as pkgbuild from './index.ts';

describe('modules/manager/pkgbuild/index', () => {
  it('exports extractPackageFile', () => {
    expect(pkgbuild.extractPackageFile).toBeDefined();
    expect(typeof pkgbuild.extractPackageFile).toBe('function');
  });

  it('exports updateDependency', () => {
    expect(pkgbuild.updateDependency).toBeDefined();
    expect(typeof pkgbuild.updateDependency).toBe('function');
  });

  it('exports displayName', () => {
    expect(pkgbuild.displayName).toBe('PKGBUILD');
  });

  it('exports url', () => {
    expect(pkgbuild.url).toBe('https://wiki.archlinux.org/title/PKGBUILD');
  });

  it('exports categories', () => {
    expect(pkgbuild.categories).toEqual(['custom']);
  });

  it('exports defaultConfig', () => {
    expect(pkgbuild.defaultConfig).toEqual({
      commitMessageTopic: 'PKGBUILD package {{depName}}',
      managerFilePatterns: ['**/PKGBUILD'],
    });
  });

  it('exports supportedDatasources', () => {
    expect(pkgbuild.supportedDatasources).toEqual([
      'cpan',
      'forgejo-tags',
      'git-tags',
      'gitea-tags',
      'github-tags',
      'gitlab-tags',
      'npm',
      'packagist',
      'pypi',
      'repology',
    ]);
  });
});
