module.exports = {
  verbose: true,
  baseBranch: 'master',
  templates: {
    branchName: (params) => {
      return `renovate/${params.depName}-${params.newVersionMajor}.x`;
    },
    commitMessage: (params) => {
      return `Upgrade dependency ${params.depName} to version ${params.newVersion}`;
    },
    prBody: (params) => {
      return `This Pull Request updates dependency ${params.depName} from version ${params.currentVersion} to ${params.newVersion}.`;
    },
    prTitleMajor: (params) => {
      return `Upgrade dependency ${params.depName} to version ${params.newVersionMajor}.x`;
    },
    prTitleMinor: (params) => {
      return `Upgrade dependency ${params.depName} to version ${params.newVersion}`;
    },
  }
};
