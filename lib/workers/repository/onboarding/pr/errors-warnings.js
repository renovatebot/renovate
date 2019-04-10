const { appName } = require('../../../../config/app-strings');

function getWarnings(config) {
  if (!config.warnings.length) {
    return '';
  }
  let warningText = `\n# Warnings (${config.warnings.length})\n\n`;
  warningText += `Please correct - or verify that you can safely ignore - these warnings before you merge this PR.\n\n`;
  config.warnings.forEach(w => {
    warningText += `-   \`${w.depName}\`: ${w.message}\n`;
  });
  warningText += '\n---\n';
  return warningText;
}

function getErrors(config) {
  let errorText = '';
  if (!config.errors.length) {
    return '';
  }
  errorText = `\n# Errors (${config.errors.length})\n\n`;
  errorText += `${appName} has found errors that you should fix (in this branch) before finishing this PR.\n\n`;
  config.errors.forEach(e => {
    errorText += `-   \`${e.depName}\`: ${e.message}\n`;
  });
  errorText += '\n---\n';
  return errorText;
}

function getDepWarnings(packageFiles) {
  let warningText = '';
  try {
    const warnings = [];
    const warningFiles = [];
    for (const files of Object.values(packageFiles || {})) {
      for (const file of files || [])
        if (file.deps) {
          for (const dep of file.deps || []) {
            if (dep.warnings && dep.warnings.length) {
              const message = dep.warnings[0].message;
              if (!warnings.includes(message)) {
                warnings.push(message);
              }
              if (!warningFiles.includes(file.packageFile)) {
                warningFiles.push(file.packageFile);
              }
            }
          }
        }
    }
    if (!warnings.length) {
      return '';
    }
    logger.info(
      { warnings, warningFiles },
      'Found package lookup warnings in onboarding'
    );
    warningText = `\n---\n\n### :warning: Dependency Lookup Warnings :warning:\n\n`;
    warningText += `Please correct - or verify that you can safely ignore - these lookup failures before you merge this PR.\n\n`;
    warnings.forEach(w => {
      warningText += `-   \`${w}\`\n`;
    });
    warningText +=
      '\nFiles affected: ' +
      warningFiles.map(f => '`' + f + '`').join(', ') +
      '\n\n';
  } catch (err) {
    // istanbul ignore next
    logger.error({ err }, 'Error generating dep warnings text');
  }
  return warningText;
}

module.exports = {
  getWarnings,
  getErrors,
  getDepWarnings,
};
