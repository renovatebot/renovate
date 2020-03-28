import core from '@actions/core';
import exec from '@actions/exec';

core.info(`Verifying ...`);
(async () => {
  try {
    core.groupStart('npm whoami');
    await exec.exec(`npm`, ['whoami']);
  } catch (e) {
    core.setFailed('npm auth error');
  } finally {
    core.endGroup('npm whoami');
  }
})();
