import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validFleetYaml = Fixtures.get('valid_fleet.yaml');
const validFleetYamlWithCustom = Fixtures.get(
  'valid_fleet_helm_target_customization.yaml',
);
const inValidFleetYaml = Fixtures.get('invalid_fleet.yaml');

const validGitRepoYaml = Fixtures.get('valid_gitrepo.yaml');
const invalidGitRepoYaml = Fixtures.get('invalid_gitrepo.yaml');

const configMapYaml = Fixtures.get('configmap.yaml', '../kubernetes');

describe('modules/manager/fleet/extract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractPackageFile()', () => {
    it('should return null if empty content', () => {
      const result = extractPackageFile('', 'fleet.yaml');

      expect(result).toBeNull();
    });

    it('should return null if a unknown manifest is supplied', () => {
      const result = extractPackageFile(configMapYaml, 'fleet.yaml');

      expect(result).toBeNull();
    });

    describe('fleet.yaml', () => {
      it('should return null if content is a malformed YAML', () => {
        const result = extractPackageFile(
          `apiVersion: v1
kind: Fleet
< `,
          'fleet.yaml',
        );

        expect(result).toBeNull();
      });

      it('should parse valid configuration', () => {
        const result = extractPackageFile(validFleetYaml, 'fleet.yaml');

        expect(result).not.toBeNull();
        expect(result?.deps).toMatchObject([
          {
            currentValue: 'v1.8.0',
            datasource: 'helm',
            depName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
          },
          {
            currentValue: '3.17.7',
            datasource: 'helm',
            depName: 'logging-operator',
            registryUrls: ['https://kubernetes-charts.banzaicloud.com'],
            depType: 'fleet',
          },
          {
            currentValue: '25.19.1',
            datasource: 'helm',
            depName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
            depType: 'fleet',
          },
          {
            currentValue: '7.1.2',
            datasource: 'docker',
            depName: 'registry-1.docker.io/bitnamicharts/external-dns',
            packageName: 'registry-1.docker.io/bitnamicharts/external-dns',
            depType: 'fleet',
            pinDigests: false,
          },
        ]);
      });

      it('should parse valid configuration with target customization', () => {
        const result = extractPackageFile(
          validFleetYamlWithCustom,
          'fleet.yaml',
        );

        expect(result).not.toBeNull();
        expect(result?.deps).toMatchObject([
          {
            currentValue: 'v1.8.0',
            datasource: 'helm',
            depName: 'cert-manager',
            packageName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
          },
          {
            currentValue: 'v1.9.2',
            datasource: 'helm',
            depName: 'rke2',
            packageName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
          },
          {
            currentValue: 'v1.8.0',
            datasource: 'helm',
            depName: 'cert-manager',
            packageName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
          },
          {
            currentValue: 'v1.8.2',
            datasource: 'helm',
            depName: 'cluster1',
            packageName: 'cert-manager',
            registryUrls: ['https://charts.example.com'],
            depType: 'fleet',
          },
          {
            currentValue: 'v1.8.0',
            datasource: 'helm',
            depName: 'cert-manager',
            packageName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
          },
          {
            datasource: 'helm',
            depName: 'cluster1',
            packageName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
            skipReason: 'unspecified-version',
          },
        ]);
      });

      it('should parse parse invalid configurations', () => {
        const result = extractPackageFile(inValidFleetYaml, 'fleet.yaml');

        expect(result).not.toBeNull();
        expect(result?.deps).toMatchObject([
          {
            skipReason: 'unspecified-version',
            datasource: 'helm',
            depName: 'cert-manager',
            registryUrls: ['https://charts.jetstack.io'],
            depType: 'fleet',
          },
          {
            datasource: 'helm',
            depName: 'logging-operator',
            skipReason: 'no-repository',
            depType: 'fleet',
          },
          {
            datasource: 'helm',
            skipReason: 'missing-depname',
            depType: 'fleet',
          },
          {
            datasource: 'helm',
            depName: './charts/example',
            skipReason: 'local-chart',
            depType: 'fleet',
          },
        ]);
      });
    });

    describe('GitRepo', () => {
      it('should return null if content is a malformed YAML', () => {
        const result = extractPackageFile(
          `apiVersion: v1
 kind: GitRepo
 < `,
          'test.yaml',
        );

        expect(result).toBeNull();
      });

      it('should parse valid configuration', () => {
        const result = extractPackageFile(validGitRepoYaml, 'test.yaml');

        expect(result).not.toBeNull();
        expect(result?.deps).toMatchObject([
          {
            currentValue: 'v0.3.0',
            datasource: 'git-tags',
            depName: 'https://github.com/rancher/fleet-examples',
            depType: 'git_repo',
            sourceUrl: 'https://github.com/rancher/fleet-examples',
          },
          {
            currentValue: '32.89.2',
            datasource: 'git-tags',
            depName: 'https://github.com/renovatebot/renovate',
            depType: 'git_repo',
            sourceUrl: 'https://github.com/renovatebot/renovate',
          },
        ]);
      });

      it('should parse invalid configuration', () => {
        const result = extractPackageFile(invalidGitRepoYaml, 'test.yaml');

        expect(result).not.toBeNull();
        expect(result?.deps).toMatchObject([
          {
            datasource: 'git-tags',
            depType: 'git_repo',
            skipReason: 'missing-depname',
          },
          {
            datasource: 'git-tags',
            depName: 'https://github.com/rancher/rancher',
            depType: 'git_repo',
            skipReason: 'unspecified-version',
            sourceUrl: 'https://github.com/rancher/rancher',
          },
        ]);
      });
    });
  });
});
