module.exports = {
  verbose: true,
  baseBranch: 'master',
  templates: {
    branchName: (params) => {
      return `renovate/${params.depName}-${params.nextVersionMajor}.x`;
    },
    commitMessage: (params) => {
      return `Upgrade dependency ${params.depName} to version ${params.nextVersion}`;
    },
    prBody: (params) => {
      return `This Pull Request updates dependency ${params.depName} from version ${params.currentVersion} to ${params.nextVersion}.`;
    },
    prTitleMajor: (params) => {
      return `Upgrade dependency ${params.depName} to version ${params.nextVersionMajor}.x`;
    },
    prTitleMinor: (params) => {
      return `Upgrade dependency ${params.depName} to version ${params.nextVersion}`;
    },
  }
};
