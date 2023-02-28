import { load } from 'js-yaml';
import { Fixtures } from '../../../../test/fixtures';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import { createDependency, processAppSpec, processSource } from './extract';
import type {
  ApplicationDefinition,
  ApplicationSource,
  ApplicationSpec,
} from './types';
import { extractPackageFile } from '.';

const validApplication = Fixtures.get('validApplication.yml');
const malformedApplication = Fixtures.get('malformedApplications.yml');
const randomManifest = Fixtures.get('randomManifest.yml');
const validApplicationSet = Fixtures.get('validApplicationSet.yml');

describe('modules/manager/argocd/extract', () => {
  describe('createDependency', () => {
    it('return null for kubernetes manifest', () => {
      const result = createDependency(
        load(randomManifest) as ApplicationDefinition
      );
      expect(result).toEqual([]);
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'applications.yml')).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(
        extractPackageFile(`${malformedApplication}\n123`, 'applications.yml')
      ).toBeNull();
    });

    it('return null for kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'applications.yml');
      expect(result).toBeNull();
    });

    it('return null if deps array would be empty', () => {
      const result = extractPackageFile(
        malformedApplication,
        'applications.yml'
      );
      expect(result).toBeNull();
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
        ],
      });
    });

    it('supports applicationsets', () => {
      const result = extractPackageFile(
        validApplicationSet,
        'applicationsets.yml'
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
        ],
      });
    });
  });

  describe('processSource()', () => {
    it('returns null for empty target revision', () => {
      const source: ApplicationSource = {
        targetRevision: '',
        repoURL: 'some-repo',
      };
      expect(processSource(source)).toBeNull();
    });

    it('returns null for empty repourl', () => {
      const source: ApplicationSource = {
        targetRevision: '1.0.3',
        repoURL: '',
      };
      expect(processSource(source)).toBeNull();
    });

    it('test OCI chart', () => {
      const source: ApplicationSource = {
        targetRevision: '1.0.3',
        repoURL: 'oci://foo',
        chart: 'bar',
      };
      expect(processSource(source)).toEqual({
        depName: `foo/bar`,
        currentValue: '1.0.3',
        datasource: DockerDatasource.id,
      });
    });

    it('test chartmuseum chart', () => {
      const source: ApplicationSource = {
        targetRevision: '1.0.3',
        repoURL: 'https://foo.io/repo',
        chart: 'bar',
      };
      expect(processSource(source)).toEqual({
        depName: `bar`,
        registryUrls: ['https://foo.io/repo'],
        currentValue: '1.0.3',
        datasource: HelmDatasource.id,
      });
    });

    it('test git repo', () => {
      const source: ApplicationSource = {
        targetRevision: '1.0.3',
        repoURL: 'https://foo.io/repo',
      };
      expect(processSource(source)).toEqual({
        depName: `https://foo.io/repo`,
        currentValue: '1.0.3',
        datasource: GitTagsDatasource.id,
      });
    });
  });

  describe('processAppSpec()', () => {
    describe('simple source', () => {
      it('returns null for empty', () => {
        expect(processAppSpec(null)).toEqual([]);
      });

      it('returns null for empty target revision', () => {
        const spec: ApplicationSpec = {
          source: { targetRevision: '', repoURL: 'some-repo' },
        };
        expect(processAppSpec(spec)).toEqual([]);
      });

      it('returns null for empty repourl', () => {
        const spec: ApplicationSpec = {
          source: { targetRevision: '1.0.3', repoURL: '' },
        };
        expect(processAppSpec(spec)).toEqual([]);
      });

      it('test OCI chart', () => {
        const spec: ApplicationSpec = {
          source: {
            targetRevision: '1.0.3',
            repoURL: 'oci://foo',
            chart: 'bar',
          },
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `foo/bar`,
            currentValue: '1.0.3',
            datasource: DockerDatasource.id,
          },
        ]);
      });

      it('test chartmuseum chart', () => {
        const spec: ApplicationSpec = {
          source: {
            targetRevision: '1.0.3',
            repoURL: 'https://foo.io/repo',
            chart: 'bar',
          },
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `bar`,
            registryUrls: ['https://foo.io/repo'],
            currentValue: '1.0.3',
            datasource: HelmDatasource.id,
          },
        ]);
      });

      it('test git repo', () => {
        const spec: ApplicationSpec = {
          source: { targetRevision: '1.0.3', repoURL: 'https://foo.io/repo' },
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `https://foo.io/repo`,
            currentValue: '1.0.3',
            datasource: GitTagsDatasource.id,
          },
        ]);
      });
    });

    describe('multiple source', () => {
      it('returns null for empty', () => {
        expect(processAppSpec(null)).toEqual([]);
      });

      it('returns null for empty target revision', () => {
        const spec: ApplicationSpec = {
          sources: [{ targetRevision: '', repoURL: 'some-repo' }],
        };
        expect(processAppSpec(spec)).toEqual([]);
      });

      it('returns null for empty repourl', () => {
        const spec: ApplicationSpec = {
          sources: [{ targetRevision: '1.0.3', repoURL: '' }],
        };
        expect(processAppSpec(spec)).toEqual([]);
      });

      it('test partial values', () => {
        const spec: ApplicationSpec = {
          sources: [
            { targetRevision: '1.0.3', repoURL: '' },
            {
              targetRevision: '1.0.3',
              repoURL: 'oci://foo',
              chart: 'bar',
            },
          ],
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `foo/bar`,
            currentValue: '1.0.3',
            datasource: DockerDatasource.id,
          },
        ]);
      });

      it('test OCI chart', () => {
        const spec: ApplicationSpec = {
          sources: [
            { targetRevision: '1.0.3', repoURL: 'oci://foo', chart: 'bar' },
          ],
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `foo/bar`,
            currentValue: '1.0.3',
            datasource: DockerDatasource.id,
          },
        ]);
      });

      it('test chartmuseum chart', () => {
        const spec: ApplicationSpec = {
          sources: [
            {
              targetRevision: '1.0.3',
              repoURL: 'https://foo.io/repo',
              chart: 'bar',
            },
          ],
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `bar`,
            registryUrls: ['https://foo.io/repo'],
            currentValue: '1.0.3',
            datasource: HelmDatasource.id,
          },
        ]);
      });

      it('test git repo', () => {
        const spec: ApplicationSpec = {
          sources: [
            { targetRevision: '1.0.3', repoURL: 'https://foo.io/repo' },
          ],
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `https://foo.io/repo`,
            currentValue: '1.0.3',
            datasource: GitTagsDatasource.id,
          },
        ]);
      });

      it('test chart and git repo combo', () => {
        const spec: ApplicationSpec = {
          sources: [
            {
              targetRevision: '1.0.3',
              repoURL: 'https://foo.io/repo',
              chart: 'bar',
            },
            { targetRevision: '1.0.3', repoURL: 'https://foo.io/repo' },
          ],
        };
        expect(processAppSpec(spec)).toEqual([
          {
            depName: `bar`,
            registryUrls: ['https://foo.io/repo'],
            currentValue: '1.0.3',
            datasource: HelmDatasource.id,
          },
          {
            depName: `https://foo.io/repo`,
            currentValue: '1.0.3',
            datasource: GitTagsDatasource.id,
          },
        ]);
      });
    });
  });
});
