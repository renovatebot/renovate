// import { mockDeep } from 'jest-mock-extended';
import { gunzipSync } from 'zlib';
import { Fixtures } from '../../../../test/fixtures';
import { Package } from './package';
import { Signed } from './signed';

const packageResponse = Fixtures.getBinary('tls_certificate_check.bin.gz');

describe('modules/datasource/hex/package', () => {
  it('decodes hex package protobuf response', () => {
    const response = Signed.decode(gunzipSync(packageResponse));

    expect(response).toContainKeys(['payload', 'signature']);

    expect(Package.decode(response.payload).name).toBe('tls_certificate_check');
  });
});
