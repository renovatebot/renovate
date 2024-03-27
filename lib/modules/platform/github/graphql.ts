export const repoInfoQuery = `
query($owner: String!, $name: String!, $user: String!) {
  repository(owner: $owner, name: $name) {
    id
    isFork
    parent {
      nameWithOwner
    }
    isArchived
    nameWithOwner
    hasIssuesEnabled
    hasVulnerabilityAlertsEnabled
    autoMergeAllowed
    mergeCommitAllowed
    rebaseMergeAllowed
    squashMergeAllowed
    defaultBranchRef {
      name
      target {
        oid
      }
    }
    issues(
      orderBy: { field: UPDATED_AT, direction: DESC },
      filterBy: { createdBy: $user },
      first: 5
    ) {
      nodes {
        number
        state
        title
        body
        updatedAt
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
        updatedAt
      }
    }
  }
}
`;

export const vulnerabilityAlertsQuery = (filterByState: boolean): string => `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    vulnerabilityAlerts(last: 100, ${filterByState ? 'states: [OPEN]' : ''}) {
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

export const enableAutoMergeMutation = `
mutation EnablePullRequestAutoMerge(
  $pullRequestId: ID!,
  $mergeMethod: PullRequestMergeMethod!,
) {
  enablePullRequestAutoMerge(
    input: {
      pullRequestId: $pullRequestId,
      mergeMethod: $mergeMethod,
    }
  ) {
    pullRequest {
      number
    }
  }
}
`;
