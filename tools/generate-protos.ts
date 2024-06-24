import * as fs from 'fs';
import { ERROR } from 'bunyan';
import { getProblems, logger } from '../lib/logger';
import { exec } from './utils/exec';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const moveFiles = async (sourceDir: string, destDir: string): Promise<void> => {
  try {
    // Read all files in the source directory
    const files: string[] = await fs.promises.readdir(sourceDir);

    const tsFiles: string[] = files.filter((file) => file.endsWith('.ts'));

    for (const file of tsFiles) {
      const sourcePath: string = `${sourceDir}/${file}`;
      const destPath: string = `${destDir}/${file}`;

      await fs.promises.rename(sourcePath, destPath);
    }

    console.log('All files have been moved successfully.');
  } catch (err) {
    console.error('Error moving files:', err);
  }
};

void (async () => {
  try {
    // protobuf definitions
    logger.info('Generating protobufs');
    await generateHexProtos();
  } catch (err) {
    logger.error({ err }, 'Unexpected error');
  } finally {
    const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
    if (loggerErrors.length) {
      process.exit(1);
    }
  }
})();

function generateProto(protos_path: string, file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const file_path = `${protos_path}/${file}`;
    const res = exec('pnpm', [
      'protoc',
      `--ts_proto_out=${protos_path}`,
      file_path,
      `--proto_path=${protos_path}`,
    ]);

    if (res.signal) {
      logger.error(`Signal received: ${res.signal}`);
      reject('');
      process.exit(-1);
    } else if (res.status && res.status !== 0) {
      logger.error(`Error occured:\n${res.stderr || res.stdout}`);
      reject('');
      process.exit(res.status);
    } else {
      logger.debug(
        `Hex protos generation succeeded:\n${res.stdout || res.stderr}`,
      );
      return resolve('');
    }
  });
}

async function generateHexProtos(): Promise<string> {
  logger.info('Generating Hex protos ...');

  const protos_path = './lib/modules/datasource/hex/protos';
  await generateProto(protos_path, 'package.proto');
  await generateProto(protos_path, 'signed.proto');
  await moveFiles(
    `${process.cwd()}/lib/modules/datasource/hex/protos`,
    `${process.cwd()}/lib/modules/datasource/hex`,
  );
  return '';
}
