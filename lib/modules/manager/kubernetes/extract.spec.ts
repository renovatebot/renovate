import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const kubernetesImagesFile = Fixtures.get('kubernetes.yaml');
const kubernetesConfigMapFile = Fixtures.get('configmap.yaml');
const versionLabelFile = Fixtures.get('version-label.yaml');
const kubernetesArraySyntaxFile = Fixtures.get('array-syntax.yaml');
const underscoreTagFile = Fixtures.get('underscore-tag.yaml');
const kubernetesRegistryAlias = Fixtures.get('kubernetes.registry-alias.yaml');
const otherYamlFile = Fixtures.get('gitlab-ci.yaml');

describe('modules/manager/kubernetes/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', 'file.yaml', {})).toBeNull();
    });

    it('does not return unknown kind', () => {
      const res = extractPackageFile(kubernetesConfigMapFile, 'file.yaml', {});
      expect(res).toBeNull();
    });

    it('extracts multiple Kubernetes configurations', () => {
      const res = extractPackageFile(kubernetesImagesFile, 'file.yaml', {});
      expect(res?.deps).toStrictEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.7.9',
          datasource: 'docker',
          depName: 'nginx',
          packageName: 'nginx',
          replaceString: 'nginx:1.7.9',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.22.1',
          datasource: 'docker',
          depName: 'nginx',
          packageName: 'nginx',
          replaceString: 'nginx:1.22.1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'v1.11.1',
          datasource: 'docker',
          depName: 'k8s.gcr.io/kube-proxy-amd64',
          packageName: 'k8s.gcr.io/kube-proxy-amd64',
          replaceString: 'k8s.gcr.io/kube-proxy-amd64:v1.11.1',
        },
        {
          currentValue: 'apps/v1',
          datasource: 'kubernetes-api',
          depName: 'Deployment',
          versioning: 'kubernetes-api',
        },
        {
          currentValue: 'extensions/v1beta1',
          datasource: 'kubernetes-api',
          depName: 'DaemonSet',
          versioning: 'kubernetes-api',
        },
      ]);
    });

    it('does not extract app version labels by default', () => {
      const res = extractPackageFile(versionLabelFile, 'file.yaml', {});

      expect(res?.deps).not.toContainEqual(
        expect.objectContaining({ autoReplaceStringTemplate: '{{newValue}}' }),
      );
    });

    it('extracts matching app version labels when enabled', () => {
      const res = extractPackageFile(versionLabelFile, 'file.yaml', {
        updateVersionLabels: true,
      });

      expect(res?.deps).toContainEqual({
        autoReplaceStringTemplate: '{{newValue}}',
        currentDigest: undefined,
        currentValue: '1.22.1',
        datasource: 'docker',
        depName: 'nginx',
        packageName: 'nginx',
        pinDigests: false,
        digestManagedExternally: true,
        replaceString: '1.22.1',
      });
      expect(res?.deps).toContainEqual({
        autoReplaceStringTemplate: '{{newValue}}',
        currentDigest: undefined,
        currentValue: 'v1.11.1',
        datasource: 'docker',
        depName: 'k8s.gcr.io/kube-proxy-amd64',
        packageName: 'k8s.gcr.io/kube-proxy-amd64',
        pinDigests: false,
        digestManagedExternally: true,
        replaceString: 'v1.11.1',
      });
      expect(
        res?.deps.filter(
          (dep) => dep.autoReplaceStringTemplate === '{{newValue}}',
        ),
      ).toHaveLength(3);
    });

    it('keeps label extraction stable while the image is updated', () => {
      const updatedContent = versionLabelFile.replace(
        'image: nginx:1.22.1',
        'image: nginx:1.22.2',
      );
      const res = extractPackageFile(updatedContent, 'file.yaml', {
        updateVersionLabels: true,
        depName: 'nginx',
        currentValue: '1.22.1',
      });

      expect(res?.deps).toContainEqual(
        expect.objectContaining({
          autoReplaceStringTemplate: '{{newValue}}',
          currentValue: '1.22.1',
          depName: 'nginx',
          replaceString: '1.22.1',
        }),
      );
    });

    it('keeps label extraction stable after the label is updated', () => {
      const updatedContent = versionLabelFile.replace('"1.22.1"', '"1.22.2"');
      const res = extractPackageFile(updatedContent, 'file.yaml', {
        updateVersionLabels: true,
        depName: 'nginx',
        currentValue: '1.22.1',
        newValue: '1.22.2',
      });

      expect(res?.deps).toContainEqual(
        expect.objectContaining({
          autoReplaceStringTemplate: '{{newValue}}',
          currentValue: '1.22.2',
          depName: 'nginx',
          replaceString: '1.22.2',
        }),
      );
    });

    it('re-extracts a label dependency without the manager option', () => {
      const updatedContent = versionLabelFile.replace('"1.22.1"', '"1.22.2"');
      const res = extractPackageFile(updatedContent, 'file.yaml', {
        digestManagedExternally: true,
        depName: 'nginx',
        currentValue: '1.22.1',
        newValue: '1.22.2',
      });

      expect(res?.deps).toContainEqual(
        expect.objectContaining({
          autoReplaceStringTemplate: '{{newValue}}',
          currentValue: '1.22.2',
          depName: 'nginx',
          replaceString: '1.22.2',
        }),
      );
    });

    it('ignores manifests without app version labels', () => {
      const res = extractPackageFile(
        codeBlock`
          apiVersion: apps/v1
          kind: Deployment
          metadata:
            name: test
          spec:
            template:
              spec:
                containers:
                  - name: test
                    image: nginx:1.2.3
        `,
        'file.yaml',
        { updateVersionLabels: true },
      );

      expect(res?.deps).not.toContainEqual(
        expect.objectContaining({ autoReplaceStringTemplate: '{{newValue}}' }),
      );
    });

    it('can disable app version label extraction', () => {
      const res = extractPackageFile(versionLabelFile, 'file.yaml', {
        updateVersionLabels: false,
      });

      expect(res?.deps).not.toContainEqual(
        expect.objectContaining({ autoReplaceStringTemplate: '{{newValue}}' }),
      );
    });

    it('extracts image line in a YAML array', () => {
      const res = extractPackageFile(
        kubernetesArraySyntaxFile,
        'file.yaml',
        {},
      );
      expect(res?.deps).toStrictEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'v2.1.0',
          datasource: 'docker',
          depName: 'quay.io/external_storage/local-volume-provisioner',
          packageName: 'quay.io/external_storage/local-volume-provisioner',
          replaceString:
            'quay.io/external_storage/local-volume-provisioner:v2.1.0',
        },
        {
          currentValue: 'apps/v1',
          datasource: 'kubernetes-api',
          depName: 'DaemonSet',
          versioning: 'kubernetes-api',
        },
      ]);
    });

    it('extracts image tag when it contains underscores', () => {
      const res = extractPackageFile(underscoreTagFile, 'file.yaml', {});
      expect(res?.deps).toStrictEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'litellm_stable_release_branch-v1.67.0-stable',
          datasource: 'docker',
          depName: 'ghcr.io/berriai/litellm',
          packageName: 'ghcr.io/berriai/litellm',
          replaceString:
            'ghcr.io/berriai/litellm:litellm_stable_release_branch-v1.67.0-stable',
        },
        {
          currentValue: 'apps/v1',
          datasource: 'kubernetes-api',
          depName: 'Deployment',
          versioning: 'kubernetes-api',
        },
      ]);
    });

    it('ignores non-Kubernetes YAML files', () => {
      expect(extractPackageFile(otherYamlFile, 'file.yaml', {})).toBeNull();
    });

    it('handles invalid YAML files', () => {
      const invalidYaml = `apiVersion: v1
kind: ConfigMap
<
`;
      expect(extractPackageFile(invalidYaml, 'file.yaml', {})).toBeNull();
    });

    it('extracts images and replaces registries', () => {
      const res = extractPackageFile(kubernetesRegistryAlias, 'file.yaml', {
        registryAliases: {
          'quay.io': 'my-quay-mirror.registry.com',
        },
      });
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              'quay.io/node:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/node',
            packageName: 'my-quay-mirror.registry.com/node',
            replaceString: 'quay.io/node:0.0.1',
          },
        ],
      });
    });

    it('extracts images but does no replacement', () => {
      const res = extractPackageFile(kubernetesRegistryAlias, 'file.yaml', {
        registryAliases: {
          'index.docker.io': 'my-docker-mirror.registry.com',
        },
      });
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/node',
            packageName: 'quay.io/node',
            replaceString: 'quay.io/node:0.0.1',
          },
        ],
      });
    });

    it('extracts images and does no double replacements', () => {
      const res = extractPackageFile(kubernetesRegistryAlias, 'file.yaml', {
        registryAliases: {
          'quay.io': 'my-quay-mirror.registry.com',
          'my-quay-mirror.registry.com': 'quay.io',
        },
      });
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              'quay.io/node:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/node',
            packageName: 'my-quay-mirror.registry.com/node',
            replaceString: 'quay.io/node:0.0.1',
          },
        ],
      });
    });

    it('extracts from complex templates', () => {
      const res = extractPackageFile(
        Fixtures.get('complex.yaml'),
        'complex.yaml',
        {},
      );
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'busybox',
            packageName: 'busybox',
            replaceString: 'busybox',
          },
        ],
      });
    });

    describe('image volume references', () => {
      it.each`
        kind                       | apiVersion
        ${'DaemonSet'}             | ${'apps/v1'}
        ${'Deployment'}            | ${'apps/v1'}
        ${'Job'}                   | ${'batch/v1'}
        ${'ReplicaSet'}            | ${'apps/v1'}
        ${'ReplicationController'} | ${'v1'}
        ${'StatefulSet'}           | ${'apps/v1'}
      `(
        'extracts image volumes from $kind',
        ({ kind, apiVersion }: { kind: string; apiVersion: string }) => {
          const res = extractPackageFile(
            codeBlock`
              apiVersion: ${apiVersion}
              kind: ${kind}
              metadata:
                name: test
              spec:
                template:
                  spec:
                    volumes:
                      - name: vol
                        image:
                          reference: quay.io/test/image:v1.0.0
            `,
            'file.yaml',
            {},
          );

          expect(res?.deps).toContainEqual({
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v1.0.0',
            datasource: 'docker',
            depName: 'quay.io/test/image',
            packageName: 'quay.io/test/image',
            replaceString: 'quay.io/test/image:v1.0.0',
          });
        },
      );

      it('extracts image volumes from Pod and CronJob', () => {
        const res = extractPackageFile(
          codeBlock`
            apiVersion: v1
            kind: Pod
            metadata:
              name: pod-test
            spec:
              volumes:
                - name: vol
                  image:
                    reference: quay.io/test/pod-image:v1.0.0
            ---
            apiVersion: batch/v1
            kind: CronJob
            metadata:
              name: cronjob-test
            spec:
              jobTemplate:
                spec:
                  template:
                    spec:
                      volumes:
                        - name: vol
                          image:
                            reference: quay.io/test/cronjob-image:v2.0.0
          `,
          'file.yaml',
          {},
        );

        expect(res?.deps).toStrictEqual([
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v1.0.0',
            datasource: 'docker',
            depName: 'quay.io/test/pod-image',
            packageName: 'quay.io/test/pod-image',
            replaceString: 'quay.io/test/pod-image:v1.0.0',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v2.0.0',
            datasource: 'docker',
            depName: 'quay.io/test/cronjob-image',
            packageName: 'quay.io/test/cronjob-image',
            replaceString: 'quay.io/test/cronjob-image:v2.0.0',
          },
          {
            currentValue: 'batch/v1',
            datasource: 'kubernetes-api',
            depName: 'CronJob',
            versioning: 'kubernetes-api',
          },
        ]);
      });

      it('does not extract image volumes for unsupported kind', () => {
        const res = extractPackageFile(
          codeBlock`
            apiVersion: extensions/v1beta1
            kind: NetworkPolicy
            metadata:
              name: test-network-policy
            spec:
              podSelector: {}
          `,
          'file.yaml',
          {},
        );
        expect(res?.deps).toStrictEqual([
          {
            currentValue: 'extensions/v1beta1',
            datasource: 'kubernetes-api',
            depName: 'NetworkPolicy',
            versioning: 'kubernetes-api',
          },
        ]);
      });

      it('skips malformed volume entries and extracts valid ones', () => {
        const res = extractPackageFile(
          codeBlock`
            apiVersion: v1
            kind: Pod
            metadata:
              name: pod-test
            spec:
              volumes:
                - name: bad-vol
                  image:
                    notReference: invalid
                - name: good-vol
                  image:
                    reference: quay.io/test/image:v1.0.0
          `,
          'file.yaml',
          {},
        );

        expect(res?.deps).toStrictEqual([
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v1.0.0',
            datasource: 'docker',
            depName: 'quay.io/test/image',
            packageName: 'quay.io/test/image',
            replaceString: 'quay.io/test/image:v1.0.0',
          },
        ]);
      });
    });
  });
});
