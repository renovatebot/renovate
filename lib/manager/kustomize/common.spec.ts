import { extractBase } from './common';

describe('manager/kustomize/common', () => {
  describe('extractBase', () => {
    it('should return null for a local base ', () => {
      const res = extractBase('./service-1');
      expect(res).toBeNull();
    });
    it('should extract out the version and source of an http base', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        depName: base,
        source: base,
        currentValue: version,
      };

      const pkg = extractBase(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version and source of a git base', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        depName: base,
        source: base,
        currentValue: version,
      };

      const pkg = extractBase(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version and source of a git base', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        depName: `${base}//subdir`,
        source: base,
        currentValue: version,
      };

      const pkg = extractBase(`${sample.depName}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
  });
});
