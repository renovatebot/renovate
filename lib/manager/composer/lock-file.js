const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const tmp = require('tmp-promise');
const upath = require('upath');

module.exports = {
  getLockFile,
};

async function getLockFile(
  packageFileName,
  updatedDeps,
  newPackageFileContent
) {
  logger.debug(`composer.getLockFile(${packageFileName})`);
  const composerLockPath = packageFileName.replace(/\.json$/, '.lock');
  const existingComposerLockContent = await platform.getFile(composerLockPath);
  if (!existingComposerLockContent) {
    logger.debug('No composer.lock found');
    return null;
  }
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  let stdout;
  let stderr;
  try {
    const composerJsonFileName = upath.join(tmpDir.path, 'composer.json');
    const composerJson = JSON.parse(newPackageFileContent);
    delete composerJson.scripts;
    await fs.outputFile(composerJsonFileName, JSON.stringify(composerJson));
    const composerLockFileName = upath.join(tmpDir.path, 'composer.lock');
    await fs.outputFile(composerLockFileName, existingComposerLockContent);
    const env = { HOME: process.env.HOME, PATH: process.env.PATH };
    const startTime = process.hrtime();
    const cmd =
      ('composer update ' + updatedDeps.join(' ')).trim() +
      ' --ignore-platform-reqs';
    logger.debug({ cmd });
    ({ stdout, stderr } = await exec(cmd, {
      cwd: tmpDir.path,
      shell: true,
      env,
    }));
    logger.debug(`composer stdout:\n${stdout}`);
    logger.debug(`composer stderr:\n${stderr}`);
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    const newComposerLockContent = await fs.readFile(
      composerLockFileName,
      'utf8'
    );
    logger.info(
      { seconds, type: 'composer.lock', stdout, stderr },
      'Generated lockfile'
    );
    if (newComposerLockContent === existingComposerLockContent) {
      logger.debug('composer.lock is unchanged');
      return null;
    }
    logger.debug('Returning updated composer.lock');
    return {
      name: composerLockPath,
      contents: newComposerLockContent,
    };
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to generate composer.lock'
    );
    return null;
  } finally {
    tmpDir.cleanup();
  }
}
