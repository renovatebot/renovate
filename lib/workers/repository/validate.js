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
  const renovatePrs = await getRenovatePrs(config.branchPrefix);
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
          validations.push({
            file,
            message: 'Invalid JSON',
          });
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
              errors.map(error => ({
                file,
                message: error.message,
              }))
            );
          }
        }
      }
      // if the PR has renovate files then we set a status no matter what
      let status;
      let description;
      const subject = 'Renovate Configuration Errors';
      if (validations.length) {
        const content = validations
          .map(v => `\`${v.file}\`: ${v.message}`)
          .join('\n\n');
        await platform.ensureComment(pr.number, subject, content);
        status = 'failure';
        description = 'Renovate config validation failed'; // GitHub limit
      } else {
        description = 'Renovate config is valid';
        status = 'success';
        await platform.ensureCommentRemoval(pr.number, subject);
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
