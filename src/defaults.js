module.exports = {
  verbose: false,
  baseBranch: 'master',
  templates: {
    branchName: (params) => {
      return `renovate/${params.depName}-${params.newVersionMajor}.x`;
    },
    commitMessage: (params) => {
      return `Update dependency ${params.depName} to version ${params.newVersion}`;
    },
    prBody: (params) => {
      return `This Pull Request updates dependency ${params.depName} from version ${params.currentVersion} to ${params.newVersion}.`;
    },
    prTitleMajor: (params) => {
      return `Update dependency ${params.depName} to version ${params.newVersionMajor}.x`;
    },
    prTitleMinor: (params) => {
      return `Update dependency ${params.depName} to version ${params.newVersion}`;
    },
    prTitlePin: (params) => {
      return `Pin dependency ${params.depName} to version ${params.newVersion}`;
    },
  }
};
