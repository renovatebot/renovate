import type { RuntimeType } from '@renovatebot/pgp';
import { decrypt, isSupportedRuntime } from '@renovatebot/pgp';
import { logger } from '../../logger';
import { getEnv } from '../../util/env';
import { regEx } from '../../util/regex';

export async function tryDecryptBcPgp(
  privateKey: string,
  encryptedStr: string,
): Promise<string | null> {
  try {
    const startBlock = '-----BEGIN PGP MESSAGE-----\n\n';
    const endBlock = '\n-----END PGP MESSAGE-----';
    let armoredMessage = encryptedStr.trim();

    const hasStartHeader = armoredMessage.startsWith(startBlock);
    const hasEndHeader = armoredMessage.endsWith(endBlock);

    if (
      !hasStartHeader &&
      !hasEndHeader &&
      !armoredMessage.includes('=') &&
      !armoredMessage.includes('\n') &&
      armoredMessage.length % 4 !== 0
    ) {
      logger.debug('Adding base64 padding to armored message');
      armoredMessage += `=`.repeat(4 - (armoredMessage.length % 4));
    }

    if (!hasStartHeader) {
      armoredMessage = `${startBlock}${armoredMessage}`;
    }
    if (!hasEndHeader) {
      armoredMessage = `${armoredMessage}${endBlock}`;
    }

    const data = await decrypt(
      privateKey.replace(regEx(/\n[ \t]+/g), '\n'), // little massage to help a common problem
      armoredMessage,
      {
        runtime: runtime(),
      },
    );
    logger.debug('Decrypted config using bcpgp');
    return data;
  } catch (err) {
    logger.debug({ err }, 'Could not decrypt using bcpgp');
    return null;
  }
}

// TODO: use `wasm-java` as default when we require node v24+.
// Node v22 hungs on exit https://github.com/nodejs/node/issues/60584
function runtime(): RuntimeType {
  const runtime = getEnv().RENOVATE_X_PGP_RUNTIME;
  if (runtime) {
    if (isSupportedRuntime(runtime)) {
      logger.trace({ runtime }, 'Using configured PGP runtime');
      return runtime;
    } else {
      logger.once.warn({ runtime }, 'Unknown PGP runtime, using wasm-dotnet');
    }
  }
  logger.trace('Using default PGP runtime: wasm-dotnet');
  return 'wasm-dotnet';
}
