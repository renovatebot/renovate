export const repoInfoQuery = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    repositoryId: id
    isFork
    isArchived
    nameWithOwner
    mergeCommitAllowed
    rebaseMergeAllowed
    squashMergeAllowed
    defaultBranchRef {
      name
      target {
        oid
      }
    }
  }
}
`;

export const closedPrsQuery = `
query($owner: String!, $name: String!, $count: Int, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      states: [CLOSED, MERGED],
      orderBy: {
        field: UPDATED_AT,
        direction: DESC
      },
      first: $count,
      after: $cursor
    ) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        number
        state
        headRefName
        title
        comments(last: 100) {
          nodes {
            databaseId
            body
          }
        }
      }
    }
  }
}
`;

export const openPrsQuery = `
query($owner: String!, $name: String!, $count: Int, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      states: [OPEN],
      orderBy: {
        field: UPDATED_AT,
        direction: DESC
      },
      first: $count,
      after: $cursor
    ) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        number
        headRefName
        baseRefName
        title
        mergeable
        mergeStateStatus
        labels(last: 100) {
          nodes {
            name
          }
        }
        assignees {
          totalCount
        }
        reviewRequests {
          totalCount
        }
        commits(first: 2) {
          nodes {
            commit {
              author {
                email
              }
              committer {
                email
              }
              parents(last: 1) {
                edges {
                  node {
                    abbreviatedOid
                    oid
                  }
                }
              }
            }
          }
        }
        body
        reviews(first: 1, states: [CHANGES_REQUESTED]){
          nodes{
            state
          }
        }
      }
    }
  }
}
`;

export const getIssuesQuery = `
query(
  $owner: String!,
  $name: String!,
  $user: String!,
  $count: Int,
  $cursor: String
) {
  repository(owner: $owner, name: $name) {
    issues(
      orderBy: { field: UPDATED_AT, direction: DESC },
      filterBy: { createdBy: $user },
      first: $count,
      after: $cursor
    ) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        number
        state
        title
        body
      }
    }
  }
}
`;

export const vulnerabilityAlertsQuery = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    vulnerabilityAlerts(last: 100) {
      edges {
        node {
          dismissReason
          vulnerableManifestFilename
          vulnerableManifestPath
          vulnerableRequirements
          securityAdvisory {
            description
            identifiers { type value }
            references { url }
            severity
          }
          securityVulnerability {
            package { name ecosystem }
            firstPatchedVersion { identifier }
            vulnerableVersionRange
          }
        }
      }
    }
  }
}
`;

export const createBranchMutation = `
mutation (
  $repositoryId: ID!,
  $branchName: String!,
  $oid: GitObjectID!,
) {
  createRef(input: {
    repositoryId: $repositoryId,
    name: $branchName,
    oid: $oid,
  }) {
    clientMutationId
  }
}
`;

export const commitFilesMutation = `
mutation (
  $repo: String!,
  $branchName: String!,
  $fileChanges: FileChanges!,
  $message: String!,
  $oid: GitObjectID!,
) {
  createCommitOnBranch(input: {
    branch: {
      repositoryNameWithOwner: $repo,
      branchName: $branchName,
    },
    expectedHeadOid: $oid,
    message: {
      headline: $message,
    },
    fileChanges: $fileChanges,
  }) {
    commit {
      oid
    }
  }
}
`;
