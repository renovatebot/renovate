import kbpgp from 'kbpgp';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';

declare module 'kbpgp' {
  export class KeyManager {
    static import_from_armored_pgp(
      opts: { armored: string },
      cb: (err: Error, pk: KeyManager) => void,
    ): void;
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace keyring {
    export class KeyRing {
      add_key_manager(pk: KeyManager): void;
    }
  }

  export class Literal {
    toString(): string;
  }

  export function unbox(
    opts: { keyfetch: keyring.KeyRing; armored: string },
    cb: (err: Error, literals: Literal[]) => void,
  ): void;
}

export async function tryDecryptKbPgp(
  privateKey: string,
  encryptedStr: string,
): Promise<string | null> {
  if (encryptedStr.length < 500) {
    // optimization during transition of public key -> pgp
    return null;
  }
  try {
    const pk = await new Promise<kbpgp.KeyManager>((resolve, reject) => {
      kbpgp.KeyManager.import_from_armored_pgp(
        {
          armored: privateKey.replace(regEx(/\n[ \t]+/g), '\n'),
        },
        (err: Error, pk) => {
          if (err) {
            reject(err);
          } else {
            resolve(pk);
          }
        },
      );
    });

    const ring = new kbpgp.keyring.KeyRing();
    ring.add_key_manager(pk);

    const startBlock = '-----BEGIN PGP MESSAGE-----\n\n';
    const endBlock = '\n-----END PGP MESSAGE-----';
    let armoredMessage = encryptedStr.trim();
    if (!armoredMessage.startsWith(startBlock)) {
      armoredMessage = `${startBlock}${armoredMessage}`;
    }
    if (!armoredMessage.endsWith(endBlock)) {
      armoredMessage = `${armoredMessage}${endBlock}`;
    }

    const data = await new Promise<kbpgp.Literal>((resolve, reject) => {
      kbpgp.unbox(
        {
          keyfetch: ring,
          armored: armoredMessage,
        },
        (err: Error, literals: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(literals[0].toString());
          }
        },
      );
    });
    logger.debug('Decrypted config using kppgp');
    return data as string;
  } catch (err) {
    logger.debug({ err }, 'Could not decrypt using kppgp');
    return null;
  }
}
