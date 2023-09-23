import type { HttpResponse } from '../../util/http/types';
import { isArtifactoryServer } from './util';

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
});
