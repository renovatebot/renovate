import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/github-actions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple docker image lines from yaml configuration file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_1.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps.filter((d) => d.datasource === 'docker')).toHaveLength(2);
    });

    it('extracts multiple action tag lines from yaml configuration file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_2.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(
        res.deps.filter((d) => d.datasource === 'github-tags')
      ).toHaveLength(8);
    });

    it('extracts multiple action tag lines with double quotes and comments', () => {
      const res = extractPackageFile(Fixtures.get('workflow_3.yml'));
      expect(res.deps).toMatchSnapshot([
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

      const res = extractPackageFile(yamlContent);
      expect(res.deps).toMatchObject([
        {
          depName: 'actions/setup-node',
          commitMessageTopic: '{{{depName}}} action',
          datasource: 'github-tags',
          versioning: 'docker',
          depType: 'action',
          replaceString:
            'actions/setup-node@56337c425554a6be30cdef71bf441f15be286854 # tag=v3.1.1',
          autoReplaceStringTemplate:
            '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}',
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
            "'{{depName}}@{{#if newDigest}}{{newDigest}}'{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}'{{/unless}}",
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
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
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
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
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
            '"{{depName}}@{{#if newDigest}}{{newDigest}}"{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          currentValue: 'v2',
        },
      ]);
    });
  });
});
