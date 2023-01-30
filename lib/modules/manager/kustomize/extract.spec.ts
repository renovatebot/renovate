import { Fixtures } from '../../../../test/fixtures';
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

const kustomizeGitSSHBase = Fixtures.get('gitSshBase.yaml');
const kustomizeEmpty = Fixtures.get('kustomizeEmpty.yaml');
const kustomizeGitSSHSubdir = Fixtures.get('gitSubdir.yaml');
const kustomizeHTTP = Fixtures.get('kustomizeHttp.yaml');
const kustomizeWithLocal = Fixtures.get('kustomizeWithLocal.yaml');
const nonKustomize = Fixtures.get('service.yaml');
const gitImages = Fixtures.get('gitImages.yaml');
const kustomizeDepsInResources = Fixtures.get('depsInResources.yaml');
const kustomizeComponent = Fixtures.get('component.yaml');
const newTag = Fixtures.get('newTag.yaml');
const newName = Fixtures.get('newName.yaml');
const digest = Fixtures.get('digest.yaml');
const kustomizeHelmChart = Fixtures.get('kustomizeHelmChart.yaml');

describe('modules/manager/kustomize/extract', () => {
  it('should successfully parse a valid kustomize file', () => {
    const file = parseKustomize(kustomizeGitSSHBase);
    expect(file).not.toBeNull();
  });

  it('return null on an invalid file', () => {
    const file = parseKustomize('');
    expect(file).toBeNull();
  });

  it('should return null when header has invalid resource kind', () => {
    const file = parseKustomize(`
      kind: NoKustomization
      bases:
      - github.com/fluxcd/flux/deploy?ref=1.19.0
    `);
    expect(file).toBeNull();
  });

  it('should fall back to default resource kind when header is missing', () => {
    const file = parseKustomize(`
      bases:
      - github.com/fluxcd/flux/deploy?ref=1.19.0
    `);
    expect(file).not.toBeNull();
    expect(file?.kind).toBe('Kustomization');
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
        name: '',
        repo: '',
        version: '',
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
        name: '',
        newTag: '',
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
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(2);
    });

    it('extracts ssh dependency', () => {
      const res = extractPackageFile(kustomizeGitSSHBase);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts ssh dependency with a subdir', () => {
      const res = extractPackageFile(kustomizeGitSSHSubdir);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts http dependency', () => {
      const res = extractPackageFile(kustomizeHTTP);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0].currentValue).toBe('v0.0.1');
      expect(res?.deps[1].currentValue).toBe('1.19.0');
      expect(res?.deps[1].depName).toBe('fluxcd/flux');
    });

    it('should extract out image versions', () => {
      const res = extractPackageFile(gitImages);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(6);
      expect(res?.deps[0].currentValue).toBe('v0.1.0');
      expect(res?.deps[1].currentValue).toBe('v0.0.1');
      expect(res?.deps[5].skipReason).toBe('invalid-value');
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
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps[0].currentValue).toBe('v0.0.1');
      expect(res?.deps[1].currentValue).toBe('1.19.0');
      expect(res?.deps[2].currentValue).toBe('1.18.0');
      expect(res?.deps[0].depName).toBe('moredhel/remote-kustomize');
      expect(res?.deps[1].depName).toBe('fluxcd/flux');
      expect(res?.deps[2].depName).toBe('fluxcd/flux');
      expect(res?.deps[0].depType).toBe('Kustomization');
      expect(res?.deps[1].depType).toBe('Kustomization');
      expect(res?.deps[2].depType).toBe('Kustomization');
    });

    it('should extract dependencies when kind is Component', () => {
      const res = extractPackageFile(kustomizeComponent);
      expect(res).not.toBeNull();
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps[0].currentValue).toBe('1.19.0');
      expect(res?.deps[1].currentValue).toBe('1.18.0');
      expect(res?.deps[2].currentValue).toBe('v0.1.0');
      expect(res?.deps[0].depName).toBe('fluxcd/flux');
      expect(res?.deps[1].depName).toBe('fluxcd/flux');
      expect(res?.deps[2].depName).toBe('node');
      expect(res?.deps[0].depType).toBe('Component');
      expect(res?.deps[1].depType).toBe('Component');
      expect(res?.deps[2].depType).toBe('Component');
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

  describe('extractResource', () => {
    const urls = [
      {
        url: 'https://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo/somedir',
        host: 'https://git-codecommit.us-east-2.amazonaws.com/',
        project: 'someorg/somerepo',
        packageName:
          'https://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo',
      },
      {
        url: 'https://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo/somedir',
        host: 'https://git-codecommit.us-east-2.amazonaws.com/',
        project: 'someorg/somerepo',
        packageName:
          'https://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo',
      },
      {
        url: 'https://fabrikops2.visualstudio.com/someorg/somerepo',
        host: 'https://fabrikops2.visualstudio.com/',
        project: 'someorg/somerepo',
        packageName: 'https://fabrikops2.visualstudio.com/someorg/somerepo',
      },
      {
        url: 'http://github.com/someorg/somerepo/somedir',
        host: 'https://github.com/',
        project: 'someorg/somerepo',
      },
      {
        url: 'git@github.com:someorg/somerepo/somedir',
        host: 'git@github.com:',
        project: 'someorg/somerepo',
      },
      {
        url: 'http://github.com/someorg/somerepo.git/somedir',
        host: 'https://github.com/',
        project: 'someorg/somerepo.git',
      },
      {
        url: 'git@github.com:someorg/somerepo.git/somedir',
        host: 'git@github.com:',
        project: 'someorg/somerepo.git',
      },
      {
        url: 'git@gitlab2.sqtools.ru:infra/kubernetes/thanos-base.git',
        host: 'git@gitlab2.sqtools.ru:',
        project: 'infra/kubernetes/thanos-base.git',
        packageName: 'git@gitlab2.sqtools.ru:infra/kubernetes/thanos-base.git',
      },
      {
        url: 'git@bitbucket.org:company/project.git//path',
        host: 'git@bitbucket.org:',
        project: 'company/project.git',
        packageName: 'git@bitbucket.org:company/project.git',
      },
      {
        url: 'git@bitbucket.org/company/project.git//path',
        host: 'git@bitbucket.org/',
        project: 'company/project.git',
        packageName: 'git@bitbucket.org/company/project.git',
      },
      {
        url: 'ssh://git@bitbucket.org/company/project.git//path',
        host: 'ssh://git@bitbucket.org/',
        project: 'company/project.git',
        packageName: 'ssh://git@bitbucket.org/company/project.git',
      },
      {
        url: 'https://itfs.mycompany.com/collection/project/_git/somerepos',
        host: 'https://itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        url: 'https://itfs.mycompany.com/collection/project/_git/somerepos',
        host: 'https://itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        url: 'https://itfs.mycompany.com/collection/project/_git/somerepos/somedir',
        host: 'https://itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        url: 'git::https://itfs.mycompany.com/collection/project/_git/somerepos',
        host: 'https://itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        url: 'https://bitbucket.example.com/scm/project/repository.git',
        host: 'https://bitbucket.example.com/',
        project: 'scm/project/repository.git',
        packageName: 'https://bitbucket.example.com/scm/project/repository.git',
      },
      {
        url: 'ssh://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo/somepath',
        host: 'ssh://git-codecommit.us-east-2.amazonaws.com/',
        project: 'someorg/somerepo',
        packageName:
          'ssh://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo',
      },
      {
        url: 'git@github.com/someorg/somerepo/somepath',
        host: 'git@github.com:',
        project: 'someorg/somerepo',
      },
      {
        url: 'https://github.com/kubernetes-sigs/kustomize//examples/multibases/dev/',
        host: 'https://github.com/',
        project: 'kubernetes-sigs/kustomize',
      },
      {
        url: 'ssh://git@github.com/kubernetes-sigs/kustomize//examples/multibases/dev',
        host: 'git@github.com:',
        project: 'kubernetes-sigs/kustomize',
      },
      {
        url: 'https://example.org/path/to/repo//examples/multibases/dev',
        host: 'https://example.org/',
        project: 'path/to/repo',
        packageName: 'https://example.org/path/to/repo',
      },
      {
        url: 'https://example.org/path/to/repo.git/examples/multibases/dev',
        host: 'https://example.org/',
        project: 'path/to/repo.git',
        packageName: 'https://example.org/path/to/repo.git',
      },
      {
        url: 'ssh://alice@example.com/path/to/repo//examples/multibases/dev',
        host: 'ssh://alice@example.com/',
        project: 'path/to/repo',
        packageName: 'ssh://alice@example.com/path/to/repo',
      },
      // {
      //   url: 'https://authority/org/repo?ref=group/version',
      //   host: 'https://authority/',
      //   project: 'org/repo',
      //   packageName: 'https://authority/org/repo',
      // },
      // {
      //   url: 'https://authority/org/repo/?ref=includes_git/for_some_reason',
      //   host: 'https://authority/',
      //   project: 'org/repo',
      //   packageName: 'https://authority/org/repo',
      // },
      // {
      //   url: 'https://authority/org/repo/?ref=includes.git/for_some_reason',
      //   host: 'https://authority/',
      //   project: 'org/repo',
      //   packageName: 'https://authority/org/repo',
      // },
      {
        url: 'https://authority/org/repo/%-invalid-uri-so-not-parsable-by-net/url.Parse',
        host: 'https://authority/',
        project: 'org/repo',
        packageName: 'https://authority/org/repo',
      },
      {
        url: 'ssh://myusername@bitbucket.org/ourteamname/ourrepositoryname.git//path',
        host: 'ssh://myusername@bitbucket.org/',
        project: 'ourteamname/ourrepositoryname.git',
        packageName:
          'ssh://myusername@bitbucket.org/ourteamname/ourrepositoryname.git',
      },
      {
        url: 'http://git@home.com/path/to/repository.git//path',
        host: 'http://git@home.com/',
        project: 'path/to/repository.git',
        packageName: 'http://git@home.com/path/to/repository.git',
      },
      {
        url: 'https://git@home.com/path/to/repository.git//path',
        host: 'https://git@home.com/',
        project: 'path/to/repository.git',
        packageName: 'https://git@home.com/path/to/repository.git',
      },
      {
        url: 'ssh://git@ssh.github.com:443/YOUR-USERNAME/YOUR-REPOSITORY.git',
        host: 'ssh://git@ssh.github.com:443/',
        project: 'YOUR-USERNAME/YOUR-REPOSITORY.git',
      },
      {
        url: 'git@gitlab.com/user:name/YOUR-REPOSITORY.git/path',
        host: 'git@gitlab.com/',
        project: 'user:name/YOUR-REPOSITORY.git',
        packageName: 'git@gitlab.com/user:name/YOUR-REPOSITORY.git',
      },
      {
        url: 'git@gitlab.com:gitlab-tests/sample-project.git',
        host: 'git@gitlab.com:',
        project: 'gitlab-tests/sample-project.git',
        packageName: 'git@gitlab.com:gitlab-tests/sample-project.git',
      },
      {
        url: 'git@gitlab.com:gitlab-tests/sample-project',
        host: 'git@gitlab.com:',
        project: 'gitlab-tests/sample-project',
        packageName: 'git@gitlab.com:gitlab-tests/sample-project',
      },
      {
        url: 'https://username@dev.azure.com/org/project/_git/repo//path/to/kustomization/root',
        host: 'https://username@dev.azure.com/',
        project: 'org/project/_git/repo',
        packageName: 'https://username@dev.azure.com/org/project/_git/repo',
      },
      {
        url: 'https://org.visualstudio.com/project/_git/repo/path/to/kustomization/root',
        host: 'https://org.visualstudio.com/',
        project: 'project/_git/repo',
        packageName: 'https://org.visualstudio.com/project/_git/repo',
      },
      {
        url: 'ssh://org-12345@github.com/kubernetes-sigs/kustomize',
        host: 'org-12345@github.com:',
        project: 'kubernetes-sigs/kustomize',
      },
      {
        url: 'org-12345@github.com/kubernetes-sigs/kustomize',
        host: 'org-12345@github.com:',
        project: 'kubernetes-sigs/kustomize',
      },
    ];

    it('extraction test all possible urls', () => {
      for (const urlObj of urls) {
        const version = 'v1.0.0';
        const sample: any = {
          currentValue: version,
        };
        if (urlObj.url.includes('github.com')) {
          sample.depName = urlObj.project.replace('.git', '');
          sample.datasource = GithubTagsDatasource.id;
        } else {
          sample.depName =
            urlObj.host.replace(
              /(?<url>(?:(?:(?:http|https|ssh):\/\/)?(?:.*@)?))/,
              ''
            ) + urlObj.project.replace('.git', '');
          sample.packageName = urlObj.packageName;
          sample.datasource = GitTagsDatasource.id;
        }

        const pkg = extractResource(`${urlObj.url}?ref=${version}`);
        expect(pkg).toEqual(sample);
      }
    });
  });
});
