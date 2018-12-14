module.exports = {
  raiseDeprecationWarnings,
};

async function raiseDeprecationWarnings(config, packageFiles) {
  if (!config.repoIsOnboarded) {
    return;
  }
  if (
    config.suppressNotifications &&
    config.suppressNotifications.includes('deprecationWarningIssues')
  ) {
    return;
  }
  for (const [manager, files] of Object.entries(packageFiles)) {
    const deprecatedPackages = {};
    for (const packageFile of files) {
      for (const dep of packageFile.deps) {
        const { deprecationMessage } = dep;
        if (deprecationMessage) {
          deprecatedPackages[dep.depName] = deprecatedPackages[dep.depName] || {
            deprecationMessage,
            depPackageFiles: [],
          };
          deprecatedPackages[dep.depName].depPackageFiles.push(
            packageFile.packageFile
          );
        }
      }
    }
    logger.debug({ deprecatedPackages });
    for (const [depName, val] of Object.entries(deprecatedPackages)) {
      const { deprecationMessage, depPackageFiles } = val;
      logger.info(
        {
          depName,
          deprecationMessage,
          packageFiles: depPackageFiles,
        },
        'dependency is deprecated'
      );
      const issueTitle = `Dependency deprecation warning: ${depName} (${manager})`;
      let issueBody = deprecationMessage;
      issueBody += `\n\nAffected package file(s): ${depPackageFiles
        .map(f => '`' + f + '`')
        .join(', ')}`;
      issueBody += `\n\nIf you don't care about this, you can close this issue and not be warned about \`${depName}\`'s deprecation again. If you would like to completely disable all future deprecation warnings then add the following to your config:\n\n\`\`\`\n"suppressNotifications": ["deprecationWarningIssues"]\n\`\`\`\n\n`;
      // istanbul ignore if
      if (config.dryRun) {
        logger.info('DRY-RUN: Ensure deprecation warning issue for ' + depName);
      } else {
        const ensureOnce = true;
        await platform.ensureIssue(issueTitle, issueBody, ensureOnce);
      }
    }
  }
}
