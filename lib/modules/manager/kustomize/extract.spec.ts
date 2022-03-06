import { loadFixture } from '../../../../test/util';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
import {
  extractHelmChart,
  extractImage,
  extractPackageFile,
  extractResource,
  parseKustomize,
} from './extract';

const kustomizeGitSSHBase = loadFixture('gitSshBase.yaml');
const kustomizeEmpty = loadFixture('kustomizeEmpty.yaml');
const kustomizeGitSSHSubdir = loadFixture('gitSubdir.yaml');
const kustomizeHTTP = loadFixture('kustomizeHttp.yaml');
const kustomizeWithLocal = loadFixture('kustomizeWithLocal.yaml');
const nonKustomize = loadFixture('service.yaml');
const gitImages = loadFixture('gitImages.yaml');
const kustomizeDepsInResources = loadFixture('depsInResources.yaml');
const kustomizeComponent = loadFixture('component.yaml');
const newTag = loadFixture('newTag.yaml');
const newName = loadFixture('newName.yaml');
const digest = loadFixture('digest.yaml');
const kustomizeHelmChart = loadFixture('kustomizeHelmChart.yaml');

describe('modules/manager/kustomize/extract', () => {
  it('should successfully parse a valid kustomize file', () => {
    const file = parseKustomize(kustomizeGitSSHBase);
    expect(file).not.toBeNull();
  });
  it('return null on an invalid file', () => {
    const file = parseKustomize('');
    expect(file).toBeNull();
  });
  describe('extractBase', () => {
    it('should return null for a local base', () => {
      const res = extractResource('./service-1');
      expect(res).toBeNull();
    });
    it('should extract out the version of an http base', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/test-repo',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract the version of a non http base', () => {
      const pkg = extractResource(
        'ssh://git@bitbucket.com/user/test-repo?ref=v1.2.3'
      );
      expect(pkg).toEqual({
        currentValue: 'v1.2.3',
        datasource: GitTagsDatasource.id,
        depName: 'bitbucket.com/user/test-repo',
        packageName: 'ssh://git@bitbucket.com/user/test-repo',
      });
    });
    it('should extract the depName if the URL includes a port number', () => {
      const pkg = extractResource(
        'ssh://git@bitbucket.com:7999/user/test-repo?ref=v1.2.3'
      );
      expect(pkg).toEqual({
        currentValue: 'v1.2.3',
        datasource: GitTagsDatasource.id,
        depName: 'bitbucket.com:7999/user/test-repo',
        packageName: 'ssh://git@bitbucket.com:7999/user/test-repo',
      });
    });
    it('should extract the version of a non http base with subdir', () => {
      const pkg = extractResource(
        'ssh://git@bitbucket.com/user/test-repo/subdir?ref=v1.2.3'
      );
      expect(pkg).toEqual({
        currentValue: 'v1.2.3',
        datasource: GitTagsDatasource.id,
        depName: 'bitbucket.com/user/test-repo',
        packageName: 'ssh://git@bitbucket.com/user/test-repo',
      });
    });
    it('should extract out the version of an github base', () => {
      const base = 'github.com/fluxcd/flux/deploy';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'fluxcd/flux',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version of a git base', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/repo',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
    it('should extract out the version of a git base with subdir', () => {
      const base = 'git@github.com:user/repo.git/subdir';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/repo',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });
  });
  describe('extractHelmChart', () => {
    it('should return null on a null input', () => {
      const pkg = extractHelmChart({
        name: null,
        repo: null,
        version: null,
      });
      expect(pkg).toBeNull();
    });
    it('should correctly extract a chart', () => {
      const registryUrl = 'https://docs.renovatebot.com/helm-charts';
      const sample = {
        depName: 'renovate',
        currentValue: '29.6.0',
        registryUrls: [registryUrl],
        datasource: HelmDatasource.id,
      };
      const pkg = extractHelmChart({
        name: sample.depName,
        version: sample.currentValue,
        repo: registryUrl,
      });
      expect(pkg).toEqual(sample);
    });
  });
  describe('image extraction', () => {
    it('should return null on a null input', () => {
      const pkg = extractImage({
        name: null,
        newTag: null,
      });
      expect(pkg).toBeNull();
    });
    it('should correctly extract a default image', () => {
      const sample = {
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'node',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract an image in a repo', () => {
      const sample = {
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'test/node',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a different registry', () => {
      const sample = {
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'quay.io/repo/image',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a different port', () => {
      const sample = {
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'localhost:5000/repo/image',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
    it('should correctly extract from a multi-depth registry', () => {
      const sample = {
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        replaceString: 'v1.0.0',
        datasource: DockerDatasource.id,
        depName: 'localhost:5000/repo/image/service',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });
  });
  describe('extractPackageFile()', () => {
    it('returns null for non kustomize kubernetes files', () => {
      expect(extractPackageFile(nonKustomize)).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(kustomizeWithLocal);
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
      expect(res.deps[0].currentValue).toBe('v0.0.1');
      expect(res.deps[1].currentValue).toBe('1.19.0');
      expect(res.deps[1].depName).toBe('fluxcd/flux');
    });
    it('should extract out image versions', () => {
      const res = extractPackageFile(gitImages);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps[0].currentValue).toBe('v0.1.0');
      expect(res.deps[1].currentValue).toBe('v0.0.1');
      expect(res.deps[5].skipReason).toBe('invalid-value');
    });
    it('ignores non-Kubernetes empty files', () => {
      expect(extractPackageFile('')).toBeNull();
    });
    it('does nothing with kustomize empty kustomize files', () => {
      expect(extractPackageFile(kustomizeEmpty)).toBeNull();
    });
    it('should extract bases resources and components from their respective blocks', () => {
      const res = extractPackageFile(kustomizeDepsInResources);
      expect(res).not.toBeNull();
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
      expect(res.deps[0].currentValue).toBe('v0.0.1');
      expect(res.deps[1].currentValue).toBe('1.19.0');
      expect(res.deps[2].currentValue).toBe('1.18.0');
      expect(res.deps[0].depName).toBe('moredhel/remote-kustomize');
      expect(res.deps[1].depName).toBe('fluxcd/flux');
      expect(res.deps[2].depName).toBe('fluxcd/flux');
      expect(res.deps[0].depType).toBe('Kustomization');
      expect(res.deps[1].depType).toBe('Kustomization');
      expect(res.deps[2].depType).toBe('Kustomization');
    });
    it('should extract dependencies when kind is Component', () => {
      const res = extractPackageFile(kustomizeComponent);
      expect(res).not.toBeNull();
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
      expect(res.deps[0].currentValue).toBe('1.19.0');
      expect(res.deps[1].currentValue).toBe('1.18.0');
      expect(res.deps[2].currentValue).toBe('v0.1.0');
      expect(res.deps[0].depName).toBe('fluxcd/flux');
      expect(res.deps[1].depName).toBe('fluxcd/flux');
      expect(res.deps[2].depName).toBe('node');
      expect(res.deps[0].depType).toBe('Component');
      expect(res.deps[1].depType).toBe('Component');
      expect(res.deps[2].depType).toBe('Component');
    });

    const postgresDigest =
      'sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c';

    it('extracts from newTag', () => {
      expect(extractPackageFile(newTag)).toMatchSnapshot({
        deps: [
          {
            currentDigest: undefined,
            currentValue: '11',
            replaceString: '11',
          },
          {
            currentDigest: postgresDigest,
            currentValue: '11',
            replaceString: `11@${postgresDigest}`,
          },
          {
            skipReason: 'invalid-value',
          },
        ],
      });
    });

    it('extracts from digest', () => {
      expect(extractPackageFile(digest)).toMatchSnapshot({
        deps: [
          {
            currentDigest: postgresDigest,
            currentValue: undefined,
            replaceString: postgresDigest,
          },
          {
            currentDigest: postgresDigest,
            currentValue: '11',
            replaceString: postgresDigest,
          },
          {
            skipReason: 'invalid-dependency-specification',
          },
          {
            skipReason: 'invalid-value',
          },
          {
            skipReason: 'invalid-value',
          },
        ],
      });
    });

    it('extracts newName', () => {
      expect(extractPackageFile(newName)).toMatchSnapshot({
        deps: [
          {
            depName: 'awesome/postgres',
            depType: 'Kustomization',
            currentDigest: postgresDigest,
            currentValue: '11',
            replaceString: `awesome/postgres:11@${postgresDigest}`,
          },
          {
            depName: 'awesome/postgres',
            depType: 'Kustomization',
            currentDigest: undefined,
            currentValue: '11',
            replaceString: 'awesome/postgres:11',
          },
          {
            depName: 'awesome/postgres',
            depType: 'Kustomization',
            currentDigest: postgresDigest,
            currentValue: undefined,
            replaceString: `awesome/postgres@${postgresDigest}`,
          },
        ],
      });
    });

    it('parses helmChart field', () => {
      const res = extractPackageFile(kustomizeHelmChart);
      expect(res).toMatchSnapshot({
        deps: [
          {
            depType: 'HelmChart',
            depName: 'minecraft',
            currentValue: '3.1.3',
            registryUrls: ['https://itzg.github.io/minecraft-server-charts'],
          },
        ],
      });
    });
  });
});
