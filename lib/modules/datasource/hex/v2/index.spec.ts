import protobuf from 'protobufjs';
import upath from 'upath';
import { Package } from './package';
import { Signed } from './signed';

function protobufLoad(file: string): Promise<protobuf.Root> {
  const resolvedFile = upath.join(__dirname, file);
  return new Promise((resolve, reject) => {
    protobuf.load(resolvedFile, (err, root) => {
      if (err) {
        reject(err);
        return;
      }

      if (!root) {
        reject(new Error('Root is empty'));
        return;
      }

      resolve(root);
    });
  });
}

describe('modules/datasource/hex/v2/index', () => {
  describe('Signed', () => {
    async function encodeSigned(input: unknown): Promise<Buffer> {
      const message = Signed.fromJSON(input);
      const root = await protobufLoad('signed.proto');
      const x = root.lookupType('Signed').encode(message).finish();
      return Buffer.from(x);
    }

    it('roundtrip', async () => {
      const input = {
        payload: Buffer.from('foo'),
        signature: Buffer.from('bar'),
      };
      const encodedBuf = await encodeSigned(input);

      const output = Signed.decode(encodedBuf);

      expect(output).toEqual(input);
    });
  });

  describe('Package', () => {
    async function encodePackage(input: unknown): Promise<Buffer> {
      const message = Package.fromJSON(input);
      const root = await protobufLoad('package.proto');
      const x = root.lookupType('Package').encode(message).finish();
      return Buffer.from(x);
    }

    it('roundtrip', async () => {
      const input: Package = {
        name: 'foo',
        repository: 'hexpm',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
          {
            version: '2.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
          {
            version: '3.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      };
      const encodedBuf = await encodePackage(input);

      const output = Package.decode(encodedBuf);

      expect(output).toMatchObject({
        name: 'foo',
        repository: 'hexpm',
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      });
    });
  });
});
