import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const kustomizeGitSSHBase = readFileSync(
  'lib/manager/kustomize/__fixtures__/gitSshBase.yaml',
  'utf8'
);

const kustomizeGitSSHSubdir = readFileSync(
  'lib/manager/kustomize/__fixtures__/gitSubdir.yaml',
  'utf8'
);

const kustomizeHTTP = readFileSync(
  'lib/manager/kustomize/__fixtures__/kustomizeHttp.yaml',
  'utf8'
);

const kustomizeWithLocal = readFileSync(
  'lib/manager/kustomize/__fixtures__/kustomizeWithLocal.yaml',
  'utf8'
);

const nonKustomize = readFileSync(
  'lib/manager/kustomize/__fixtures__/service.yaml',
  'utf8'
);

describe('lib/manager/kustomize/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for non kustomize kubernetes files', () => {
      expect(extractPackageFile(nonKustomize)).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(kustomizeHTTP);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('extracts ssh dependency', () => {
      const res = extractPackageFile(kustomizeGitSSHBase);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extracts ssh dependency with a subdir', () => {
      const res = extractPackageFile(kustomizeGitSSHSubdir);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extracts http dependency', () => {
      const res = extractPackageFile(kustomizeHTTP);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
      expect(res.deps[1].source).toEqual(
        'https://github.com/moredhel/remote-kustomize.git'
      );
      expect(res.deps[1].currentValue).toEqual('v0.0.1');
    });

    it('ignores non-Kubernetes empty files', () => {
      expect(extractPackageFile('')).toBeNull();
    });
  });
});
