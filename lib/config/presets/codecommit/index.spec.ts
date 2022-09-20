import { CodeCommitClient, GetFileCommand } from '@aws-sdk/client-codecommit';
import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { mockClient } from 'aws-sdk-client-mock';
import { TextEncoder } from 'web-encoding';
import { Platform, setPlatformApi } from '../../../modules/platform';
import { PRESET_DEP_NOT_FOUND } from '../util';
import * as codeCommit from '.';

const codeCommitClient = mockClient(CodeCommitClient);
const iamClient = mockClient(IAMClient);

jest.unmock('../../../modules/platform');

describe('config/presets/codecommit/index', () => {
  let codeCommitPlatform: Platform;
  const data = { foo: 'bar' };

  beforeEach(async () => {
    setPlatformApi('codecommit');
    codeCommitPlatform = await import('../../../modules/platform/codecommit');
    iamClient.on(GetUserCommand).resolves({
      User: {
        Arn: 'aws:arn:example:123456',
        UserName: 'someone',
        UserId: 'something',
        Path: 'somewhere',
        CreateDate: new Date(),
      },
    });
    await codeCommitPlatform.initPlatform({
      endpoint: 'https://git-codecommit.eu-central-1.amazonaws.com/',
      username: 'accessKeyId',
      password: 'SecretAccessKey',
    });
    const encoder = new TextEncoder();
    const int8arrData = encoder.encode(JSON.stringify(data));
    codeCommitClient.on(GetFileCommand).resolves({ fileContent: int8arrData });
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      const res = await codeCommit.fetchJSONFile(
        'some/repo',
        'some-filename.json'
      );
      expect(res).toEqual(data);
    });

    it('throws on error', async () => {
      codeCommitClient.on(GetFileCommand).rejectsOnce(new Error('unknown'));
      await expect(
        codeCommit.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom path', async () => {
      const res = await codeCommit.getPresetFromEndpoint(
        'some/repo',
        'some-filename',
        'foo/bar',
        ''
      );
      expect(res).toEqual(data);
    });
  });
});
