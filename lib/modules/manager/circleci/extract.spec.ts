import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const file1 = Fixtures.get('config.yml');
const file2 = Fixtures.get('config2.yml');
const file3 = Fixtures.get('config3.yml');
const file4 = Fixtures.get('config4.yml');

describe('modules/manager/circleci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image and resolves yaml anchors', () => {
      const res = extractPackageFile(file1);
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          depName: 'node',
          depType: 'docker',
          replaceString: 'node',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '4',
          datasource: 'docker',
          depName: 'node',
          depType: 'docker',
          replaceString: 'node:4',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '6',
          datasource: 'docker',
          depName: 'node',
          depType: 'docker',
          replaceString: 'node:6',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '8.9.0',
          datasource: 'docker',
          depName: 'node',
          depType: 'docker',
          replaceString: 'node:8.9.0',
        },
      ]);
    });

    it('extracts orbs too', () => {
      const res = extractPackageFile(file2);
      expect(res?.deps).toEqual([
        {
          currentValue: '4.1.0',
          datasource: 'orb',
          depName: 'release-workflows',
          depType: 'orb',
          packageName: 'hutson/library-release-workflows',
          versioning: 'npm',
        },
        {
          datasource: 'orb',
          depName: 'no-version',
          depType: 'orb',
          packageName: 'abc/def',
          versioning: 'npm',
        },
        {
          currentValue: 'volatile',
          datasource: 'orb',
          depName: 'volatile',
          depType: 'orb',
          packageName: 'zzz/zzz',
          versioning: 'npm',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
          currentValue: '3.7',
          datasource: 'docker',
          depName: 'python',
          depType: 'docker',
          replaceString:
            'python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
          currentValue: '3.7',
          datasource: 'docker',
          depName: 'python',
          depType: 'docker',
          replaceString:
            'python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
          currentValue: '3.7',
          datasource: 'docker',
          depName: 'python',
          depType: 'docker',
          replaceString:
            'python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
          currentValue: '3.7',
          datasource: 'docker',
          depName: 'python',
          depType: 'docker',
          replaceString:
            'python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:eb6325b75c1c70b4992eaa1bdd29e24e5f14d5324b4714a49f3e67783473214b',
          currentValue: '3-6',
          datasource: 'docker',
          depName: 'pypy',
          depType: 'docker',
          replaceString:
            'pypy:3-6@sha256:eb6325b75c1c70b4992eaa1bdd29e24e5f14d5324b4714a49f3e67783473214b',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
          currentValue: '3.7',
          datasource: 'docker',
          depName: 'python',
          depType: 'docker',
          replaceString:
            'python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077',
        },
      ]);
    });

    it('extracts image without leading dash', () => {
      const res = extractPackageFile(file3);
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '14.8.0',
          datasource: 'docker',
          depName: 'cimg/node',
          depType: 'docker',
          replaceString: 'cimg/node:14.8.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '14.8.0',
          datasource: 'docker',
          depName: 'cimg/node',
          depType: 'docker',
          replaceString: 'cimg/node:14.8.0',
        },
      ]);
    });

    it('extracts and exclude android images', () => {
      expect(
        extractPackageFile(codeBlock`
        jobs:
          build:
            machine:
              image: android:202102-01
        `),
      ).toBeNull();
    });

    it('extracts orbs without jobs', () => {
      const res = extractPackageFile(file4);
      expect(res?.deps).toEqual([
        {
          currentValue: '5.2.0',
          datasource: 'orb',
          depName: 'nodejs',
          depType: 'orb',
          packageName: 'circleci/node',
          versioning: 'npm',
        },
      ]);
    });

    it('extracts executors', () => {
      const res = extractPackageFile(codeBlock`
      executors:
        my-executor:
          docker:
            - image: cimg/ruby:3.0.3-browsers`);
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '3.0.3-browsers',
          datasource: 'docker',
          depName: 'cimg/ruby',
          depType: 'docker',
          replaceString: 'cimg/ruby:3.0.3-browsers',
        },
      ]);
    });
  });
});
