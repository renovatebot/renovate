import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const runnerTestWorkflow = `
jobs:
  test1:
    runs-on: ubuntu-latest
  test2:
    runs-on:
      ubuntu-22.04
  test3:
    runs-on: "macos-12-xl"
  test4:
    runs-on: 'macos-latest'
  test5:
    runs-on: |
      windows-2019
  test6:
    runs-on: >
      windows-2022
`;

describe('modules/manager/github-actions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'empty-workflow.yml')
      ).toBeNull();
    });

    it('returns null for invalid yaml', () => {
      expect(
        extractPackageFile('nothing here: [', 'invalid-workflow.yml')
      ).toBeNull();
    });

    it('extracts multiple docker image lines from yaml configuration file', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_1.yml'),
        'workflow_1.yml'
      );
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps.filter((d) => d.datasource === 'docker')).toHaveLength(
        6
      );
    });

    it('extracts multiple action tag lines from yaml configuration file', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_2.yml'),
        'workflow_2.yml'
      );
      expect(res?.deps).toMatchSnapshot();
      expect(
        res?.deps.filter((d) => d.datasource === 'github-tags')
      ).toHaveLength(8);
    });

    it('extracts multiple action tag lines with double quotes and comments', () => {
      const res = extractPackageFile(
        Fixtures.get('workflow_3.yml'),
        'workflow_3.yml'
      );

      expect(res?.deps).toMatchObject([
        {
          depName: 'pascalgn/automerge-action',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString: '"pascalgn/automerge-action@v0.13.1"',
          autoReplaceStringTemplate:
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          currentValue: 'v0.13.1',
        },
        {
          depName: 'actions/checkout',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # renovate: tag=v2.3.5',
          autoReplaceStringTemplate:
            '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}',
          currentValue: 'v2.3.5',
          currentDigest: '1e204e9a9253d643386038d443f96446fa156a97',
        },
        {
          depName: 'actions/checkout',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString: 'actions/checkout@v1',
          autoReplaceStringTemplate:
            '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}',
          currentValue: 'v1',
        },
        {
          depName: 'actions/checkout',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString: '"actions/checkout@v1.1.2"',
          autoReplaceStringTemplate:
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          currentValue: 'v1.1.2',
        },
        {
          depName: 'ubuntu',
          currentValue: 'latest',
          replaceString: 'ubuntu-latest',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
        {
          depName: 'ubuntu',
          currentValue: 'latest',
          replaceString: 'ubuntu-latest',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
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
        'workflow_4.yml'
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
          skipReason: 'invalid-version',
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
      ]);
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
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
        {
          depName: 'ubuntu',
          currentValue: '22.04',
          replaceString: 'ubuntu-22.04',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
        {
          depName: 'macos',
          currentValue: '12-xl',
          replaceString: 'macos-12-xl',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
        {
          depName: 'macos',
          currentValue: 'latest',
          replaceString: 'macos-latest',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
        {
          depName: 'windows',
          currentValue: '2019\n',
          replaceString: 'windows-2019\n',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
        {
          depName: 'windows',
          currentValue: '2022\n',
          replaceString: 'windows-2022\n',
          depType: 'github-runner',
          datasource: 'github-runners',
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}-{{newValue}}{{/if}}',
        },
      ]);
      expect(
        res?.deps.filter((d) => d.datasource === 'github-runners')
      ).toHaveLength(6);
    });
  });
});
