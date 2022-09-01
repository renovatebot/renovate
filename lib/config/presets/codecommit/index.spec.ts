import { TextEncoder } from 'web-encoding';
import { Platform, setPlatformApi } from '../../../modules/platform';
import { PRESET_DEP_NOT_FOUND } from '../util';
import * as codeCommit from '.';

jest.unmock('../../../modules/platform');
jest.mock('@aws-sdk/client-codecommit');
jest.mock('@aws-sdk/client-iam');

describe('config/presets/codecommit/index', () => {
  let codeCommitPlatform: Platform;
  let codeCommitClient: any;
  let iamClient: any;

  beforeEach(async () => {
    setPlatformApi('codecommit');
    const mod = require('@aws-sdk/client-codecommit');
    codeCommitClient = mod['CodeCommit'];
    codeCommitPlatform = await import('../../../modules/platform/codecommit');

    const modIam = require('@aws-sdk/client-iam');
    iamClient = modIam['IAM'];
    jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
      throw new Error('User: aws:arn:example:123456 has no permissions');
    });
    await codeCommitPlatform.initPlatform({
      endpoint: 'https://git-codecommit.eu-central-1.amazonaws.com/',
      username: 'accessKeyId',
      password: 'SecretAccessKey',
    });
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      const data = { foo: 'bar' };
      const encoder = new TextEncoder();
      const int8arrData = encoder.encode(JSON.stringify(data));
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return { fileContent: int8arrData };
        });

      const res = await codeCommit.fetchJSONFile(
        'some/repo',
        'some-filename.json'
      );
      expect(res).toEqual(data);
    });

    it('throws on error', async () => {
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw new Error('unkown');
        });
      await expect(
        codeCommit.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom path', async () => {
      const data = { foo: 'bar' };
      const encoder = new TextEncoder();
      const int8arrData = encoder.encode(JSON.stringify(data));
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return { fileContent: int8arrData };
        });
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
