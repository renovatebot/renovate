const { migrateAndValidate } = require('../../config/migrate-validate');

async function getRenovatePrs(branchPrefix) {
  return (await platform.getPrList())
    .filter(pr => pr.state === 'open')
    .filter(pr => pr.branchName && !pr.branchName.startsWith(branchPrefix))
    .filter(pr => pr.title && pr.title.match(/renovate/i));
}

async function getRenovateFiles(prNo) {
  const configFileNames = [
    'package.json',
    'renovate.json',
    '.renovaterc',
    '.renovaterc.json',
  ];
  return (await platform.getPrFiles(prNo)).filter(file =>
    configFileNames.includes(file)
  );
}

async function validatePrs(config) {
  const renovatePrs = await getRenovatePrs(config.branchName);
  let validations = [];
  for (const pr of renovatePrs) {
    try {
      const renovateFiles = await getRenovateFiles(pr.number);
      if (!renovateFiles.length) {
        continue; // eslint-disable-line no-continue
      }
      logger.info(
        { prNo: pr.number, title: pr.title, renovateFiles },
        'PR has renovate files'
      );
      for (const file of renovateFiles) {
        const content = await platform.getFile(file, pr.branchName);
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (err) {
          validations.push('Cannot parse ' + file);
        }
        if (parsed) {
          const { errors } = migrateAndValidate(
            config,
            file === 'package.json'
              ? parsed.renovate || parsed['renovate-config']
              : parsed
          );
          if (errors && errors.length) {
            validations = validations.concat(
              errors.map(error => error.message)
            );
          }
        }
      }
      // if the PR has renovate files then we set a status no matter what
      let status;
      let description;
      if (validations.length) {
        description = validations.join(', ').substring(0, 140); // GitHub limit
        status = 'failure';
      } else {
        description = 'Renovate config is valid';
        status = 'success';
      }
      logger.info({ status, description }, 'Setting PR validation status');
      const context = 'renovate/validate';
      await platform.setBranchStatus(
        pr.branchName,
        context,
        description,
        status
      );
    } catch (err) {
      logger.warn(
        {
          err,
          message: err.message,
          body: err.response ? err.response.body : undefined,
          prNo: pr.number,
          branchName: pr.branchName,
        },
        'Error checking PR'
      );
    }
  }
}

module.exports = {
  validatePrs,
};
