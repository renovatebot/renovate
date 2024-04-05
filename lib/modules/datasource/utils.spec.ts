import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { mocked } from '../../../test/util';
import type { HttpResponse } from '../../util/http/types';
import { getGoogleAuthToken, isArtifactoryServer } from './util';

const googleAuth = mocked(_googleAuth);
jest.mock('google-auth-library');

describe('modules/datasource/utils', () => {
  it('is artifactory server invalid', () => {
    const response: HttpResponse<string> = {
      statusCode: 200,
      body: 'test',
      headers: { 'invalid-header': 'version' },
    };
    expect(isArtifactoryServer(response)).toBeFalse();
  });

  it('is artifactory server valid', () => {
    const response: HttpResponse<string> = {
      statusCode: 200,
      body: 'test',
      headers: { 'x-jfrog-version': 'version' },
    };
    expect(isArtifactoryServer(response)).toBeTrue();
  });

  it('retrieves a Google Access token', async () => {
    googleAuth.mockImplementationOnce(
      jest.fn().mockImplementationOnce(() => ({
        getAccessToken: jest.fn().mockResolvedValue('some-token'),
      })),
    );

    const res = await getGoogleAuthToken();
    expect(res).toBe('b2F1dGgyYWNjZXNzdG9rZW46c29tZS10b2tlbg==');
  });

  it('no Google Access token results in null', async () => {
    googleAuth.mockImplementationOnce(
      jest.fn().mockImplementationOnce(() => ({
        getAccessToken: jest.fn().mockReturnValue(''),
      })),
    );

    const res = await getGoogleAuthToken();
    expect(res).toBeNull();
  });

  it('Google Access token error throws an exception', async () => {
    const err = 'some-error';
    googleAuth.mockImplementationOnce(
      jest.fn().mockImplementationOnce(() => ({
        getAccessToken: jest.fn().mockRejectedValue(new Error(err)),
      })),
    );

    await expect(getGoogleAuthToken()).rejects.toThrow('some-error');
  });

  it('Google Access token could not load default credentials', async () => {
    googleAuth.mockImplementationOnce(
      jest.fn().mockImplementationOnce(() => ({
        getAccessToken: jest.fn().mockRejectedValue({
          message: 'Could not load the default credentials',
        }),
      })),
    );

    const res = await getGoogleAuthToken();
    expect(res).toBeNull();
  });
});
