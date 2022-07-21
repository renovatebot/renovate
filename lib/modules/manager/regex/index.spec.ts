import { Fixtures } from '../../../../test/fixtures';
import { logger } from '../../../logger';
import type { CustomExtractConfig } from '../types';
import { defaultConfig, extractPackageFile } from '.';

const dockerfileContent = Fixtures.get(`Dockerfile`);
const ansibleYamlContent = Fixtures.get(`ansible.yml`);
const exampleJsonContent = Fixtures.get(`example.json`);
const exampleGitlabCiYml = Fixtures.get(`gitlab-ci.yml`);

describe('modules/manager/regex/index', () => {
  it('has default config', () => {
    expect(defaultConfig).toEqual({
      pinDigests: false,
    });
  });

  it('extracts multiple dependencies', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
      ],
      versioningTemplate:
        '{{#if versioning}}{{versioning}}{{else}}semver{{/if}}',
      depTypeTemplate: 'final',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(8);
    expect(res?.deps.find((dep) => dep.depName === 'yarn')?.versioning).toBe(
      'semver'
    );
    expect(res?.deps.find((dep) => dep.depName === 'gradle')?.versioning).toBe(
      'maven'
    );
    expect(res?.deps.filter((dep) => dep.depType === 'final')).toHaveLength(8);
  });

  it('returns null if no dependencies found', async () => {
    const config = {
      matchStrings: [
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
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
        'ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>[^&]*?)(\\&versioning=(?<versioning>[^&]*?))?\\s',
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

  it('extracts extractVersion', async () => {
    const config = {
      matchStrings: [
        'ENV NGINX_MODULE_HEADERS_MORE_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?(\\&extractVersion=(?<extractVersion>.*?))?\\s',
      ],
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
    expect(
      res?.deps.find(
        (dep) => dep.depName === 'openresty/headers-more-nginx-module'
      )?.extractVersion
    ).toBe('^v(?<version>.*)$');
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
          repository: https://charts.helm.sh/stable
          name: prometheus-operator
          version: 8.12.13
      `,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot({
      deps: [
        {
          currentValue: '8.12.13',
          datasource: 'helm',
          depName: 'prometheus-operator',
          registryUrls: ['https://charts.helm.sh/stable'],
        },
      ],
    });
  });

  it('extracts and applies a registryUrlTemplate', async () => {
    const config = {
      matchStrings: [
        'ENV GRADLE_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      registryUrlTemplate: 'http://registry.{{depName}}.com/',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
    expect(
      res?.deps.find((dep) => dep.depName === 'gradle')?.registryUrls
    ).toEqual(['http://registry.gradle.com/']);
  });

  it('extracts and does not apply a registryUrlTemplate if the result is an invalid url', async () => {
    jest.mock('../../../logger');
    const config = {
      matchStrings: [
        'ENV GRADLE_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s',
      ],
      registryUrlTemplate: 'this-is-not-a-valid-url-{{depName}}',
    };
    const res = await extractPackageFile(
      dockerfileContent,
      'Dockerfile',
      config
    );
    expect(res).toMatchSnapshot({
      deps: [
        {
          currentValue: '6.2',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'maven',
        },
      ],
    });
    expect(logger.warn).toHaveBeenCalledWith(
      { value: 'this-is-not-a-valid-url-gradle' },
      'Invalid regex manager registryUrl'
    );
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
    expect(res?.deps).toHaveLength(2);
    expect(
      res?.deps.find((dep) => dep.depName === 'nodejs/node')?.versioning
    ).toBe('node');
    expect(res?.deps.find((dep) => dep.depName === 'gradle')?.versioning).toBe(
      'maven'
    );
  });

  it('extracts dependency with autoReplaceStringTemplate', async () => {
    const config = {
      matchStrings: [
        'image:\\s+(?<depName>my\\.old\\.registry\\/aRepository\\/andImage):(?<currentValue>[^\\s]+)',
      ],
      depNameTemplate: 'my.new.registry/aRepository/andImage',
      autoReplaceStringTemplate: 'image: {{{depName}}}:{{{newValue}}}',
      datasourceTemplate: 'docker',
    };
    const res = await extractPackageFile(
      'image: my.old.registry/aRepository/andImage:1.18-alpine',
      'values.yaml',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with combination strategy', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        'prometheus_image:\\s*"(?<depName>.*)"\\s*\\/\\/',
        'prometheus_version:\\s*"(?<currentValue>.*)"\\s*\\/\\/',
      ],
      matchStringsStrategy: 'combination',
      datasourceTemplate: 'docker',
    };
    const res = await extractPackageFile(
      ansibleYamlContent,
      'ansible.yml',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with combination strategy and non standard capture groups', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        'prometheus_registry:\\s*"(?<registry>.*)"\\s*\\/\\/',
        'prometheus_repository:\\s*"(?<repository>.*)"\\s*\\/\\/',
        'prometheus_tag:\\s*"(?<tag>.*)"\\s*\\/\\/',
        'prometheus_version:\\s*"(?<currentValue>.*)"\\s*\\/\\/',
      ],
      matchStringsStrategy: 'combination',
      datasourceTemplate: 'docker',
      depNameTemplate: '{{{ registry }}}/{{{ repository }}}',
    };
    const res = await extractPackageFile(
      ansibleYamlContent,
      'ansible.yml',
      config
    );
    expect(res?.deps).toHaveLength(1);
    expect(res?.deps[0].depName).toBe('docker.io/prom/prometheus');
    expect(res).toMatchSnapshot();
  });

  it('extracts with combination strategy and multiple matches', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        '.*_image:\\s*"(?<depName>.*)"\\s*\\/\\/',
        '.*_version:\\s*"(?<currentValue>.*)"\\s*\\/\\/',
      ],
      matchStringsStrategy: 'combination',
      datasourceTemplate: 'docker',
    };
    const res = await extractPackageFile(
      ansibleYamlContent,
      'ansible.yml',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with combination strategy and registry url', async () => {
    const config: CustomExtractConfig = {
      matchStringsStrategy: 'combination',
      matchStrings: [
        'CHART_VERSION: (?<currentValue>.*?)\n',
        'CHART_REPOSITORY_URL: "(?<registryUrl>.*?)"',
        'CHART_NAME: "(?<depName>.*?)"',
      ],
      datasourceTemplate: 'helm',
    };
    const res = await extractPackageFile(
      exampleGitlabCiYml,
      '.gitlab-ci.yml',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with combination strategy and templates', async () => {
    const config: CustomExtractConfig = {
      matchStringsStrategy: 'combination',
      matchStrings: [
        'CHART_REPOSITORY_URL: "(?<registryUrl>.*)\\/(?<depName>[a-z]+)\\/"',
        'CHART_VERSION: (?<currentValue>.*?)\n',
      ],
      datasourceTemplate: 'helm',
      depNameTemplate: 'helm_repo/{{{ depName }}}',
    };
    const res = await extractPackageFile(
      exampleGitlabCiYml,
      '.gitlab-ci.yml',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with combination strategy and empty file', async () => {
    const config: CustomExtractConfig = {
      matchStringsStrategy: 'combination',
      matchStrings: [
        'CHART_REPOSITORY_URL: "(?<registryUrl>.*)\\/(?<depName>[a-z]+)\\/"',
        'CHART_VERSION: (?<currentValue>.*?)\n',
      ],
      datasourceTemplate: 'helm',
      depNameTemplate: 'helm_repo/{{{ depName }}}',
    };
    const res = await extractPackageFile('', '.gitlab-ci.yml', config);
    expect(res).toBeNull();
  });

  it('extracts with recursive strategy and single match', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        '"group1":\\s*\\{[^}]*}',
        '"name":\\s*"(?<depName>.*)"[^"]*"type":\\s*"(?<datasource>.*)"[^"]*"value":\\s*"(?<currentValue>.*)"',
      ],
      matchStringsStrategy: 'recursive',
    };
    const res = await extractPackageFile(
      exampleJsonContent,
      'example.json',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with recursive strategy and multiple matches', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        '"group.{1}":\\s*\\{[^}]*}',
        '"name":\\s*"(?<depName>.*)"[^"]*"type":\\s*"(?<datasource>.*)"[^"]*"value":\\s*"(?<currentValue>.*)"',
      ],
      matchStringsStrategy: 'recursive',
    };
    const res = await extractPackageFile(
      exampleJsonContent,
      'example.json',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(2);
  });

  it('extracts with recursive strategy and multiple layers ', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        '"backup":\\s*{[^}]*}',
        '"test":\\s*\\{[^}]*}',
        '"name":\\s*"(?<depName>.*)"[^"]*"type":\\s*"(?<datasource>.*)"[^"]*"value":\\s*"(?<currentValue>.*)"',
      ],
      matchStringsStrategy: 'recursive',
    };
    const res = await extractPackageFile(
      exampleJsonContent,
      'example.json',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(1);
  });

  it('extracts with recursive strategy and fail because of not sufficient regexes', async () => {
    const config: CustomExtractConfig = {
      matchStrings: ['"group.{1}":\\s*\\{[^}]*}'],
      matchStringsStrategy: 'recursive',
    };
    const res = await extractPackageFile(
      exampleJsonContent,
      'example.json',
      config
    );
    expect(res).toBeNull();
  });

  it('extracts with recursive strategy and fail because there is no match', async () => {
    const config: CustomExtractConfig = {
      matchStrings: ['"trunk.{1}":\\s*\\{[^}]*}'],
      matchStringsStrategy: 'recursive',
    };
    const res = await extractPackageFile(
      exampleJsonContent,
      'example.json',
      config
    );
    expect(res).toBeNull();
  });

  it('extracts with recursive strategy and merged groups', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        '"(?<first>[^"]*)":\\s*{[^}]*}',
        '"(?<second>[^"]*)":\\s*\\{[^}]*}',
        '"name":\\s*"(?<depName>.*)"[^"]*"type":\\s*"(?<datasource>.*)"[^"]*"value":\\s*"(?<currentValue>.*)"',
      ],
      matchStringsStrategy: 'recursive',
      depNameTemplate: '{{{ first }}}/{{{ second }}}/{{{ depName }}}',
    };
    const res = await extractPackageFile(
      exampleJsonContent,
      'example.json',
      config
    );
    expect(res).toMatchSnapshot();
    expect(res?.deps).toHaveLength(4);
  });

  it('extracts with recursive strategy and without depName', async () => {
    const config: CustomExtractConfig = {
      matchStrings: [
        'jacoco\\s*{[^}]*}',
        'toolVersion\\s*=\\s*\\"(?<currentValue>\\S*)\\"\\s*',
      ],
      matchStringsStrategy: 'recursive',
      depNameTemplate: 'org.jacoco:jacoco',
      datasourceTemplate: 'maven',
    };
    const res = await extractPackageFile(
      `
    jacoco {
      toolVersion = "0.8.7"
    }
    `,
      'build.gradle.kts',
      config
    );
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'org.jacoco:jacoco',
          currentValue: '0.8.7',
          datasource: 'maven',
        },
      ],
    });
  });
});
