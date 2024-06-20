import { gunzip } from 'zlib';
import { Fixtures } from '../../../../test/fixtures';
import { Package } from './package';
import { Signed } from './signed';

const packageResponse = Fixtures.getBinary('tls_certificate_check.bin.gz');

describe('modules/datasource/hex/package', () => {
  it('decodes hex package protobuf response', () => {
    gunzip(packageResponse, (err, signedPackage) => {
      expect(err).toBeNull();

      const response = Signed.decode(signedPackage);

      expect(response).toContainKeys(['payload', 'signature']);

      expect(Package.decode(response.payload).name).toBe(
        'tls_certificate_check',
      );
    });
  });
});
