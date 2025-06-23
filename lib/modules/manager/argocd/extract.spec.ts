import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validApplication = Fixtures.get('validApplication.yml');
const malformedApplication = Fixtures.get('malformedApplications.yml');
const randomManifest = Fixtures.get('randomManifest.yml');
const validApplicationSet = Fixtures.get('validApplicationSet.yml');

describe('modules/manager/argocd/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'applications.yml')).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(
        extractPackageFile(`${malformedApplication}\n123`, 'applications.yml'),
      ).toBeNull();
    });

    it('return null for kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'applications.yml');
      expect(result).toBeNull();
    });

    it('return null if deps array would be empty', () => {
      const result = extractPackageFile(
        malformedApplication,
        'applications.yml',
      );
      expect(result).toBeNull();
    });

    it('return result for double quoted argoproj.io apiVersion reference', () => {
      const result = extractPackageFile(
        `
apiVersion: "argoproj.io/v1alpha1"
kind: Application
spec:
  source:
    chart: kube-state-metrics
    repoURL: https://prometheus-community.github.io/helm-charts
    targetRevision: 2.4.1
        `,
        'applications.yml',
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '2.4.1',
            datasource: 'helm',
            depName: 'kube-state-metrics',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
        ],
      });
    });

    it('return result for single quoted argoproj.io apiVersion reference', () => {
      const result = extractPackageFile(
        `
apiVersion: 'argoproj.io/v1alpha1'
kind: Application
spec:
  source:
    chart: kube-state-metrics
    repoURL: https://prometheus-community.github.io/helm-charts
    targetRevision: 2.4.1
        `,
        'applications.yml',
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '2.4.1',
            datasource: 'helm',
            depName: 'kube-state-metrics',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
        ],
      });
    });

    it('full test', () => {
      const result = extractPackageFile(validApplication, 'applications.yml');
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.4.1',
            datasource: 'helm',
            depName: 'kube-state-metrics',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: '0.0.2',
            datasource: 'helm',
            depName: 'traefik',
            registryUrls: ['gs://helm-charts-internal'],
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentValue: 'v2.3.4',
            datasource: 'docker',
            depName: 'somecontainer.registry.io/someContainer',
            packageName: 'somecontainer.registry.io/someContainer',
            replaceString: 'somecontainer.registry.io/someContainer:v2.3.4',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:8be5de38826b494a8ad1565b8d1eb49183d736d0277a89191bd1100d78479a42',
            datasource: 'docker',
            depName: 'othercontainer.registry.io/other/container',
            packageName: 'othercontainer.registry.io/other/container',
            replaceString:
              'othercontainer.registry.io/other/container@sha256:8be5de38826b494a8ad1565b8d1eb49183d736d0277a89191bd1100d78479a42',
          },
          {
            currentValue: '1.2.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io/some/image',
          },
          {
            currentValue: '1.3.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io/some/image2',
          },
          {
            currentValue: '1.3.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image2',
          },
          {
            currentValue: '1.0.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image3',
          },
          {
            currentValue: '1.0.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image3',
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '1.0.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image3',
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '0.0.2',
            datasource: 'helm',
            depName: 'traefik',
            registryUrls: ['gs://helm-charts-internal'],
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '0.0.2',
            datasource: 'helm',
            depName: 'somechart',
            registryUrls: ['https://foo.io/repo'],
          },
          {
            currentValue: '3.2.1',
            datasource: 'helm',
            depName: 'somechart',
            registryUrls: ['https://git.example.com/foo/bar.git'],
          },
        ],
      });
    });

    it('supports applicationsets', () => {
      const result = extractPackageFile(
        validApplicationSet,
        'applicationsets.yml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.4.1',
            datasource: 'helm',
            depName: 'kube-state-metrics',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: '10.14.2',
            datasource: 'helm',
            depName: 'traefik',
            registryUrls: ['https://helm.traefik.io/traefik'],
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '6.0.0',
            datasource: 'helm',
            depName: 'podinfo',
            registryUrls: ['https://stefanprodan.github.io/podinfo'],
          },
          {
            currentValue: '1.0.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image3',
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '1.0.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image3',
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '0.0.2',
            datasource: 'helm',
            depName: 'somechart',
            registryUrls: ['https://foo.io/repo'],
          },
        ],
      });
    });
  });
});
