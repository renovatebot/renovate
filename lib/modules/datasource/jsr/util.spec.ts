import { extractJsrPackageName } from './util';

describe('modules/datasource/jsr/util', () => {
  it('should extract package name', () => {
    const res = extractJsrPackageName('@scope/package-name');
    expect(res).toStrictEqual({
      scope: 'scope',
      name: 'package-name',
    });
  });

  it('should return null for invalid name', () => {
    const res = extractJsrPackageName('@invalid/package/name');
    expect(res).toBeNull();
  });

  it('should return null for below scope min length', () => {
    const res = extractJsrPackageName('@sc/packagename');
    expect(res).toBeNull();
  });

  it('should return null for exceed scope max length', () => {
    const res = extractJsrPackageName(`@a`.repeat(101) + '/' + 'packagename');
    expect(res).toBeNull();
  });

  it('should return null for invalid scope name', () => {
    const res = extractJsrPackageName('@🦕🦕🦕/package-name');
    expect(res).toBeNull();
  });

  it('should return null for invalid package name starting with @', () => {
    const res = extractJsrPackageName('@scope/@package-name');
    expect(res).toBeNull();
  });

  it('should return null for exceed package max length', () => {
    const res = extractJsrPackageName('@scope/' + `a`.repeat(59));
    expect(res).toBeNull();
  });

  it('should return null for invalid package name', () => {
    const res = extractJsrPackageName('@scope/PACKAGE-NAME');
    expect(res).toBeNull();
  });

  it('should return null for invalid package name starting with -', () => {
    const res = extractJsrPackageName('@scope/-package-name');
    expect(res).toBeNull();
  });
});
