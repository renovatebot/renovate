import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const kubernetesImagesFile = Fixtures.get('kubernetes.yaml');
const kubernetesConfigMapFile = Fixtures.get('configmap.yaml');
const kubernetesArraySyntaxFile = Fixtures.get('array-syntax.yaml');
const otherYamlFile = Fixtures.get('gitlab-ci.yaml');

describe('modules/manager/kubernetes/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', 'file.yaml')).toBeNull();
    });

    it('returns only API version', () => {
      const res = extractPackageFile(kubernetesConfigMapFile, 'file.yaml');
      expect(res?.deps).toStrictEqual([
        {
          currentValue: 'v1',
          depName: 'ConfigMap',
        },
      ]);
    });

    it('extracts multiple Kubernetes configurations', () => {
      const res = extractPackageFile(kubernetesImagesFile, 'file.yaml');
      expect(res?.deps).toStrictEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.7.9',
          datasource: 'docker',
          depName: 'nginx',
          replaceString: 'nginx:1.7.9',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'v1.11.1',
          datasource: 'docker',
          depName: 'k8s.gcr.io/kube-proxy-amd64',
          replaceString: 'k8s.gcr.io/kube-proxy-amd64:v1.11.1',
        },
        {
          currentValue: 'apps/v1',
          depName: 'Deployment',
        },
        {
          currentValue: 'extensions/v1beta1',
          depName: 'DaemonSet',
        },
      ]);
    });

    it('extracts image line in a YAML array', () => {
      const res = extractPackageFile(kubernetesArraySyntaxFile, 'file.yaml');
      expect(res?.deps).toStrictEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'v2.1.0',
          datasource: 'docker',
          depName: 'quay.io/external_storage/local-volume-provisioner',
          replaceString:
            'quay.io/external_storage/local-volume-provisioner:v2.1.0',
        },
        {
          currentValue: 'apps/v1',
          depName: 'DaemonSet',
        },
      ]);
    });

    it('ignores non-Kubernetes YAML files', () => {
      expect(extractPackageFile(otherYamlFile, 'file.yaml')).toBeNull();
    });

    it('handles invalid YAML files', () => {
      const invalidYaml = `apiVersion: v1
kind: ConfigMap
<
`;
      expect(extractPackageFile(invalidYaml, 'file.yaml')).toBeNull();
    });
  });
});
