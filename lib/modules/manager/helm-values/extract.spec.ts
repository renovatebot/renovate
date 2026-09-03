import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { partial } from '~test/util.ts';
import type { ExtractConfig } from '../types.ts';
import { extractPackageFile } from './index.ts';

const config = partial<ExtractConfig>({});

const configAliases = partial<ExtractConfig>({
  registryAliases: {
    'quay.io': 'registry.internal/mirror/quay.io',
  },
});

const packageFile = 'values.yaml';

describe('modules/manager/helm-values/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [', packageFile, config);
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('', packageFile, config);
      expect(result).toBeNull();
    });

    it('extracts from values.yaml correctly with same structure as "helm create"', () => {
      const helmDefaultChartInitValues = codeBlock`
        # Default values for test-chart.
        # This is a YAML-formatted file.
        # Declare variables to be passed into your templates.

        replicaCount: 1

        image:
          repository: nginx
          tag: 1.16.1
          pullPolicy: IfNotPresent

        imagePullSecrets: []
        nameOverride: ""
        fullnameOverride: ""

        serviceAccount:
          # Specifies whether a service account should be created
          create: true
          # The name of the service account to use.
          # If not set and create is true, a name is generated using the fullname template
          name:

        podSecurityContext: {}
          # fsGroup: 2000

        securityContext: {}
          # capabilities:
          #   drop:
          #   - ALL
          # readOnlyRootFilesystem: true
          # runAsNonRoot: true
          # runAsUser: 1000

        service:
          type: ClusterIP
          port: 80

        ingress:
          enabled: false
          annotations: {}
            # kubernetes.io/ingress.class: nginx
            # kubernetes.io/tls-acme: "true"
          hosts:
            - host: chart-example.local
              paths: []

          tls: []
          #  - secretName: chart-example-tls
          #    hosts:
          #      - chart-example.local

        resources: {}
          # We usually recommend not to specify default resources and to leave this as a conscious
          # choice for the user. This also increases chances charts run on environments with little
          # resources, such as Minikube. If you do want to specify resources, uncomment the following
          # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
          # limits:
          #   cpu: 100m
          #   memory: 128Mi
          # requests:
          #   cpu: 100m
          #   memory: 128Mi

        nodeSelector: {}

        tolerations: []

        affinity: {}
      `;
      const result = extractPackageFile(
        helmDefaultChartInitValues,
        packageFile,
        config,
      );
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: '1.16.1',
            depName: 'nginx',
          },
        ],
      });
    });

    it('extracts from complex values file correctly"', () => {
      const helmMultiAndNestedImageValues = codeBlock`
        inline_image: docker.io/library/nginx:1.18-alpine

        api:
          image:
            image:
              repository: bitnami/postgresql
              tag: 11.6.0-debian-9-r0
              some-non-image-related-key: 'with-some-value'
          # https://github.com/helm/charts/blob/c5838636973a5546196db6e48ae46f99a55900c4/stable/postgresql/values.yaml#L426
          metrics:
            image:
              registry: docker.io
              repository: bitnami/postgres-exporter
              tag: 0.7.0-debian-9-r12
              pullPolicy: IfNotPresent

        someOtherKey:
          - image:
              registry: docker.io
              repository: bitnami/postgresql
              tag: 11.5.0-debian-9-r0@sha256:4762726f1471ef048dd807afdc0e19265e95ffdcc7cb4a34891f680290022809
              some-non-image-related-key: 'with-some-value'

        empty_key:

        # https://github.com/bitnami/charts/blob/eae34fdbf16e2cb6a6f809d72cd22f98f6bceccc/bitnami/harbor/values.yaml#L14-L17
        coreImage:
          registry: docker.io
          repository: bitnami/harbor-core
          version: 2.1.3-debian-10-r38
      `;
      const result = extractPackageFile(
        helmMultiAndNestedImageValues,
        packageFile,
        config,
      );
      expect(result).toMatchSnapshot();
      expect(result?.deps).toHaveLength(5);
    });

    it('extract data from file with multiple documents', () => {
      const multiDocumentFile = Fixtures.get(
        'single_file_with_multiple_documents.yaml',
      );
      const result = extractPackageFile(multiDocumentFile, packageFile, config);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/controller',
            datasource: 'docker',
            versioning: 'docker',
          },
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/speaker',
            datasource: 'docker',
            versioning: 'docker',
          },
        ],
      });
    });

    it('extract data from file with registry aliases', () => {
      const multiDocumentFile = Fixtures.get(
        'single_file_with_multiple_documents.yaml',
      );
      const result = extractPackageFile(
        multiDocumentFile,
        packageFile,
        configAliases,
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/controller',
            packageName: 'registry.internal/mirror/quay.io/metallb/controller',
            datasource: 'docker',
            versioning: 'docker',
          },
          {
            currentValue: 'v0.13.10',
            depName: 'quay.io/metallb/speaker',
            packageName: 'registry.internal/mirror/quay.io/metallb/speaker',
            datasource: 'docker',
            versioning: 'docker',
          },
        ],
      });
    });
  });
});
