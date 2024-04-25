import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/bitbucket-pipelines/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'bitbucket-pipelines.yaml', {}),
      ).toBeNull();
    });

    it('returns null for malformed', () => {
      expect(
        extractPackageFile(
          'image:\n  username: ccc',
          'bitbucket-pipelines.yaml',
          {},
        ),
      ).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(
        Fixtures.get('bitbucket-pipelines.yaml'),
        'bitbucket-pipelines.yaml',
        {},
      );
      expect(res).toMatchObject({
        deps: [
          {
            currentDigest: undefined,
            currentValue: '10.15.1',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '18.15.0',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '18.15.1',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '18.15.2',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '10.15.2',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '2.0.2',
            datasource: 'docker',
            depName: 'jfrogecosystem/jfrog-setup-cli',
            depType: 'docker',
          },
          {
            currentValue: '0.2.1',
            datasource: 'bitbucket-tags',
            depName: 'atlassian/aws-s3-deploy',
            depType: 'bitbucket-tags',
          },
        ],
      });
    });

    it('extracts dependencies with registryAlias', () => {
      const res = extractPackageFile(
        Fixtures.get('bitbucket-pipelines.yaml'),
        'bitbucket-pipelines.yaml',
        {
          registryAliases: {
            jfrogecosystem: 'some.jfrog.mirror',
          },
        },
      );
      expect(res).toMatchObject({
        deps: [
          {
            currentDigest: undefined,
            currentValue: '10.15.1',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '18.15.0',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '18.15.1',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '18.15.2',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '10.15.2',
            datasource: 'docker',
            depName: 'node',
            depType: 'docker',
          },
          {
            currentDigest: undefined,
            currentValue: '2.0.2',
            datasource: 'docker',
            depName: 'some.jfrog.mirror/jfrog-setup-cli',
            depType: 'docker',
          },
          {
            currentValue: '0.2.1',
            datasource: 'bitbucket-tags',
            depName: 'atlassian/aws-s3-deploy',
            depType: 'bitbucket-tags',
          },
        ],
      });
    });
  });
});
