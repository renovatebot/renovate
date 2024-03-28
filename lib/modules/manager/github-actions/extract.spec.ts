import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';

const runnerTestWorkflow = `
jobs:
  test1:
    runs-on: ubuntu-latest
  test2:
    runs-on:
      ubuntu-22.04
  test3:
    runs-on: "macos-12-large"
  test4:
    runs-on: 'macos-latest'
  test5:
    runs-on: |
      windows-2019
  test6:
    runs-on: >
      windows-2022
  test7:
    runs-on: [windows-2022, selfhosted]
  test8:
     runs-on: \${{ env.RUNNER }}
  test9:
     runs-on:
       group: ubuntu-runners
       labels: ubuntu-20.04-16core
  test10:
      runs-on: abc-123
`;

describe('modules/manager/github-actions/extract', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'empty-workflow.yml'),
      ).toBeNull();
    });

    it('returns null for invalid yaml', () => {
      expect(
        extractPackageFile('nothing here: [', 'invalid-workflow.yml'),
      ).toBeNull();
    });

    it('extracts multiple docker image lines from yaml configuration file', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_1.yml'),
        'workflow_1.yml',
      );
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps.filter((d) => d.datasource === 'docker')).toHaveLength(
        6,
      );
    });

    it('extracts multiple action tag lines from yaml configuration file', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps).toMatchSnapshot();
      expect(
        res?.deps.filter((d) => d.datasource === 'github-tags'),
      ).toHaveLength(8);
    });

    it('use github.com as registry when no settings provided', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps[0].registryUrls).toBeUndefined();
    });

    it('use github.enterprise.com first and then github.com as registry running against github.enterprise.com', () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://github.enterprise.com',
      });
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps[0].registryUrls).toEqual([
        'https://github.enterprise.com',
        'https://github.com',
      ]);
    });

    it('use github.enterprise.com first and then github.com as registry running against github.enterprise.com/api/v3', () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://github.enterprise.com/api/v3',
      });
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps[0].registryUrls).toEqual([
        'https://github.enterprise.com',
        'https://github.com',
      ]);
    });

    it('use github.com only as registry when running against non-GitHub', () => {
      GlobalConfig.set({
        platform: 'bitbucket',
        endpoint: 'https://bitbucket.enterprise.com',
      });
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps[0].registryUrls).toBeUndefined();
    });

    it('use github.com only as registry when running against github.com', () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://github.com',
      });
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps[0].registryUrls).toBeUndefined();
    });

    it('use github.com only as registry when running against api.github.com', () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://api.github.com',
      });
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml',
      );
      expect(res?.deps[0].registryUrls).toBeUndefined();
    });

    it('extracts multiple action tag lines with double quotes and comments', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_3.yml'),
        'workflow_3.yml',
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: 'v0.13.1',
          datasource: 'github-tags',
          depName: 'pascalgn/automerge-action',
          depType: 'action',
          replaceString: '"pascalgn/automerge-action@v0.13.1"',
          versioning: 'docker',
        },
        {
          currentValue: 'v2.3.5',
          datasource: 'github-tags',
          depName: 'actions/checkout',
          depType: 'action',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # renovate: tag=v2.3.5',
          versioning: 'docker',
        },
        {
          currentValue: 'v1',
          datasource: 'github-tags',
          depName: 'actions/checkout',
          depType: 'action',
          replaceString: 'actions/checkout@v1',
          versioning: 'docker',
        },
        {
          currentValue: 'v1.1.2',
          datasource: 'github-tags',
          depName: 'actions/checkout',
          depType: 'action',
          replaceString: '"actions/checkout@v1.1.2"',
          versioning: 'docker',
        },
        {
          currentValue: 'latest',
          datasource: 'github-runners',
          depName: 'ubuntu',
          depType: 'github-runner',
          replaceString: 'ubuntu-latest',
        },
        {
          currentValue: 'latest',
          datasource: 'github-runners',
          depName: 'ubuntu',
          depType: 'github-runner',
          replaceString: 'ubuntu-latest',
        },
      ]);
    });

    it('maintains quotes', () => {
      const yamlContent = `
      jobs:
        build:
          steps:
            - name: "test1"
              uses: actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # tag=v3.1.1
            - name: "test2"
              uses: 'actions/setup-node@1f8c6b94b26d0feae1e387ca63ccbdc44d27b561' # tag=v3.1.1
            - name: "test3"
              uses: "actions/setup-node@1f8c6b94b26d0feae1e387ca63ccbdc44d27b561" # tag=v2.5.1
            - name: "checkout repository"
              uses: "actions/checkout@v2" # comment after
            - name: "quoted, no comment, outdated"
              uses: "actions/setup-java@v2"`;

      const res = extractPackageFile(yamlContent, 'workflow.yml');
      expect(res?.deps).toMatchObject([
        {
          depName: 'actions/setup-node',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString:
            'actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # tag=v3.1.1',
          autoReplaceStringTemplate:
            '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}',
          currentValue: 'v3.1.1',
          currentDigest: '56337c425554a6be30cdef71bf441f15be286854',
        },
        {
          depName: 'actions/setup-node',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString:
            "'actions/setup-node@1f8c6b94b26d0feae1e387ca63ccbdc44d27b561' # tag=v3.1.1",
          autoReplaceStringTemplate:
            "'{{depName}}@{{#if newDigest}}{{newDigest}}'{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}'{{/unless}}",
          currentValue: 'v3.1.1',
          currentDigest: '1f8c6b94b26d0feae1e387ca63ccbdc44d27b561',
        },
        {
          depName: 'actions/setup-node',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString:
            '"actions/setup-node@1f8c6b94b26d0feae1e387ca63ccbdc44d27b561" # tag=v2.5.1',
          autoReplaceStringTemplate:
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          currentValue: 'v2.5.1',
          currentDigest: '1f8c6b94b26d0feae1e387ca63ccbdc44d27b561',
        },
        {
          depName: 'actions/checkout',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString: '"actions/checkout@v2"',
          autoReplaceStringTemplate:
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          currentValue: 'v2',
        },
        {
          depName: 'actions/setup-java',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString: '"actions/setup-java@v2"',
          autoReplaceStringTemplate:
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          currentValue: 'v2',
        },
      ]);
    });

    it('extracts tags in different formats', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_4.yml'),
        'workflow_4.yml',
      );
      expect(res?.deps).toMatchObject([
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: '1.2.3',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # 1.2.3',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: '1.2',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # 1.2',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: '1',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # 1',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v1.2.3',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # v1.2.3',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v1.2',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # v1.2',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v1',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # v1',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # @v2.1.0',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # pin @v2.1.0',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # tag=v2.1.0',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97  #   v2.1.0',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 #v2.1.0',
        },
        {
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 #v2.1.0',
        },
        {
          currentDigestShort: '1e204e',
          currentValue: 'v2.1.0',
          replaceString: 'actions/checkout@1e204e # v2.1.0',
        },
        {
          currentValue: '01aecc#v2.1.0',
          replaceString: 'actions/checkout@01aecc#v2.1.0',
        },
        {
          currentDigest: '689fcce700ae7ffc576f2b029b51b2ffb66d3abd',
          currentValue: undefined,
          replaceString:
            'actions/checkout@689fcce700ae7ffc576f2b029b51b2ffb66d3abd',
        },
        {
          currentDigest: '689fcce700ae7ffc576f2b029b51b2ffb66d3abd',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@689fcce700ae7ffc576f2b029b51b2ffb66d3abd # v2.1.0',
        },
        {
          currentDigest: '689fcce700ae7ffc576f2b029b51b2ffb66d3abd',
          currentValue: 'v2.1.0',
          replaceString:
            'actions/checkout@689fcce700ae7ffc576f2b029b51b2ffb66d3abd # ratchet:actions/checkout@v2.1.0',
        },
        {
          currentDigest: '689fcce700ae7ffc576f2b029b51b2ffb66d3abd',
          currentValue: undefined,
          replaceString:
            'actions/checkout@689fcce700ae7ffc576f2b029b51b2ffb66d3abd # ratchet:exclude',
        },
        {
          currentDigest: 'f1d7c52253b89f0beae60141f8465d9495cdc2cf',
          currentValue: 'actions-runner-controller-0.23.5',
          replaceString:
            'actions-runner-controller/execute-assert-arc-e2e@f1d7c52253b89f0beae60141f8465d9495cdc2cf # actions-runner-controller-0.23.5',
        },
      ]);

      expect(res!.deps[14]).not.toHaveProperty('skipReason');
    });

    it('extracts actions with fqdn', () => {
      const res = extractPackageFile(
        codeBlock`
        jobs:
          build:
            steps:
              - name: "test1"
                uses: https://github.com/actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # tag=v3.1.1
              - name: "test2"
                uses: https://code.forgejo.org/actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # v3.1.1
              - name: "test3"
                uses: https://code.domain.test/actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # v3.1.1

          `,
        'sample.yml',
      );
      expect(res).toMatchObject({
        deps: [
          {
            currentDigest: '56337c425554a6be30cdef71bf441f15be286854',
            currentValue: 'v3.1.1',
            replaceString:
              'https://github.com/actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # tag=v3.1.1',
            datasource: 'github-tags',
            registryUrls: ['https://github.com/'],
          },
          {
            currentDigest: '56337c425554a6be30cdef71bf441f15be286854',
            currentValue: 'v3.1.1',
            replaceString:
              'https://code.forgejo.org/actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # v3.1.1',
            datasource: 'gitea-tags',
            registryUrls: ['https://code.forgejo.org/'],
          },
          {
            skipReason: 'unsupported-url',
          },
        ],
      });

      expect(res!.deps[2]).not.toHaveProperty('registryUrls');
    });

    it('extracts multiple action runners from yaml configuration file', () => {
      const res = extractPackageFile(runnerTestWorkflow, 'workflow.yml');

      expect(res?.deps).toMatchObject([
        {
          depName: 'ubuntu',
          currentValue: 'latest',
          replaceString: 'ubuntu-latest',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
          skipReason: 'invalid-version',
        },
        {
          depName: 'ubuntu',
          currentValue: '22.04',
          replaceString: 'ubuntu-22.04',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
        },
        {
          depName: 'macos',
          currentValue: '12-large',
          replaceString: 'macos-12-large',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
        },
        {
          depName: 'macos',
          currentValue: 'latest',
          replaceString: 'macos-latest',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
          skipReason: 'invalid-version',
        },
        {
          depName: 'windows',
          currentValue: '2019',
          replaceString: 'windows-2019',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
        },
        {
          depName: 'windows',
          currentValue: '2022',
          replaceString: 'windows-2022',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
        },
        {
          depName: 'windows',
          currentValue: '2022',
          replaceString: 'windows-2022',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate: '{{depName}}-{{newValue}}',
        },
      ]);
      expect(
        res?.deps.filter((d) => d.datasource === 'github-runners'),
      ).toHaveLength(7);
    });
  });
});
