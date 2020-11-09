import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { defaultConfig, extractPackageFile } from '.';

const dockerfileContent = readFileSync(
  resolve(__dirname, `./__fixtures__/Dockerfile`),
  'utf8'
);
describe(getName(__filename), () => {
  it('has default config', () => {
    expect(defaultConfig).toEqual({
      pinDigests: false,
    });
  });
  it('extracts multiple dependencies', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res.deps).toHaveLength(8);
    expect(res.deps.find((dep) => dep.depName === 'yarn').versioning).toEqual(
      'semver'
    );
    expect(res.deps.find((dep) => dep.depName === 'gradle').versioning).toEqual(
      'maven'
    );
  });
  it('returns null if no dependencies found', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await extractPackageFile('', 'Dockerfile', config);
    expect(res).toBeNull();
  });
  it('returns null if invalid template', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate: '{{#if versioning}}{{versioning}}{{else}}semver',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toBeNull();
  });
  it('extracts registryUrl', async () => {
    const config = {
      matchStrings: [
        'chart:\n *repository: (?<registryUrl>.*?)\n *name: (?<depName>.*?)\n *version: (?<currentValue>.*)\n',
      ],
      datasourceTemplate: 'helm',
    };
    const res = await extractPackageFile(
      `
      apiVersion: helm.fluxcd.io/v1
      kind: HelmRelease
      metadata:
        name: prometheus-operator
        namespace: monitoring
      spec:
        releaseName: prometheus-operator
        chart:
          repository: https://kubernetes-charts.storage.googleapis.com/
          name: prometheus-operator
          version: 8.12.13
      `,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
  });
  it('extracts multiple dependencies with multiple matchStrings', async () => {
    const config = {
      matchStrings: [
        'ENV GRADLE_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
        'ENV NODE_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res.deps).toHaveLength(2);
    expect(
      res.deps.find((dep) => dep.depName === 'nodejs/node').versioning
    ).toEqual('node');
    expect(res.deps.find((dep) => dep.depName === 'gradle').versioning).toEqual(
      'maven'
    );
  });
});
