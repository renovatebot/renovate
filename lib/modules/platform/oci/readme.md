# Oracle Cloud Infrastructure DevOps

Renovate supports OCI DevOps hosted Git repositories as an experimental platform.
This integration is unrelated to OCI container and artifact registries.

## Authentication

OCI uses separate authentication for REST API operations and Git operations.

### REST API

Configure an OCI SDK profile in `~/.oci/config`, including `user`, `tenancy`, `fingerprint`, `key_file`, and `region`.
The private key must correspond to an API key registered with your OCI user.
Set `OCI_CONFIG_FILE` and `OCI_CONFIG_PROFILE` to use another file or profile.
The default profile is `DEFAULT`.

The identity requires permission to read repositories and files, and to list, create, update, close, and reopen pull requests and manage their comments.
Git access additionally requires permission to read and update repository content.
Scope permissions to the intended repositories or compartment.

By default, the API endpoint is derived from the region in the profile.
You can override it with an HTTPS `endpoint`, for example `https://devops.eu-milan-1.oci.oraclecloud.com/`.
Do not use the Git SCM endpoint as the REST API endpoint.

### IAM and project setup

An administrator must configure both the bot permissions and the DevOps project.
Permissions held by the bot user do not automatically apply to the repository resource principal.

For a manual-review deployment, the following policy template limits the bot to repository access, PR lifecycle operations, and comments in one compartment.
Replace `Default/RenovateBot` with the identity domain and user group containing the bot, and replace `<compartment-ocid>` with the target compartment OCID.
The PR policy intentionally excludes merge and delete operations.

```text
Allow group Default/RenovateBot to read devops-project in compartment id <compartment-ocid>
Allow group Default/RenovateBot to use devops-repository in compartment id <compartment-ocid>
Allow group Default/RenovateBot to manage devops-pull-request in compartment id <compartment-ocid> where any {request.operation = 'ListPullRequests', request.operation = 'GetPullRequest', request.operation = 'CreatePullRequest', request.operation = 'UpdatePullRequest', request.operation = 'DeclinePullRequest', request.operation = 'ReopenPullRequest'}
Allow group Default/RenovateBot to manage devops-pull-request-comment in compartment id <compartment-ocid>
```

Create a separate dynamic group for the repository resource, using the manual matching-rule editor:

```text
ALL {resource.type = 'devopsrepository', resource.id = '<repository-ocid>'}
```

Grant this dynamic group user-inspection permission for PR notifications, as described in the [OCI code repository policies](https://docs.oracle.com/en-us/iaas/Content/devops/using/devops_iampolicies.htm#coderepo_policies).
For example, create the following policy at the tenancy root, replacing the domain and dynamic group names:

```text
Allow dynamic-group Default/RenovateRepositories to inspect users in tenancy
```

Use a single `ALL {...}` block, not a nested `ALL {ALL {...}}` expression.
Do not add the bot user to this dynamic group; membership is determined from the repository resource OCID.
Allow time for IAM changes to propagate.

Configure a Notifications topic on the DevOps project in the repository region.
Open **Developer Services > DevOps > Projects**, select the project, and select **Edit > Select Topic**.
The project notification configuration must reference a valid topic OCID rather than an empty string.
Add and confirm an appropriate subscription if you want to receive notification messages.
See [Creating a Project](https://docs.oracle.com/en-us/iaas/Content/devops/using/create_project.htm) and [Editing a Project](https://docs.oracle.com/en-us/iaas/Content/devops/using/edit_project.htm).

### HTTPS Git access (default)

Configure Git credentials through a credential manager, or set `username` and `password` in Renovate.
The username is `tenancyName/domainName/userName` (omit the domain segment for accounts without identity domains).
The password is an OCI **auth token**, not the Console password or API private key.
Inject credentials securely; do not commit them to your repository.

### SSH Git access

Set `gitUrl: 'ssh'` and configure SSH in the environment running Renovate:

```sshconfig title="~/.ssh/config"
Host devops.scmservice.eu-milan-1.oci.oraclecloud.com
    User domainName/userName@tenancyName
    IdentityFile ~/.ssh/oci_devops
    IdentitiesOnly yes
```

Register the corresponding public key with your OCI user.
For accounts without identity domains, use `userName@tenancyName`.
Verify the server fingerprint against the fingerprints published by Oracle before adding it to `known_hosts`; do not disable host-key verification.
An SSH agent can provide passphrase-protected keys.
REST API credentials are still required when using SSH.

## Configuration

Use repository **OCIDs**, not repository names or clone URLs:

```js title="config.js"
module.exports = {
  platform: 'oci',
  endpoint: 'https://devops.eu-milan-1.oci.oraclecloud.com/',
  repositories: ['ocid1.devopsrepository.oc1.eu-milan-1.example'],
  gitAuthor: 'Renovate Bot <renovate@example.com>',
  gitUrl: 'default', // HTTPS; use 'ssh' for SSH
  dependencyDashboard: false,
  automerge: false,
  platformAutomerge: false,
  draftPR: false,
  prCreation: 'immediate',
};
```

For autodiscovery, configure `autodiscoverProjects` with project OCIDs, or set `OCI_COMPARTMENT_ID` to discover repositories within one compartment.
Mirrored repositories are excluded because they are read-only.

## Supported features

- Cloning and pushing branches using HTTPS or SSH
- Reading repository files and local configuration presets by OCID
- Listing, creating, updating, retargeting, closing, and reopening pull requests
- Adding reviewers using user OCIDs, and managing bot-authored, top-level PR comments
- Recognizing previously closed and manually merged pull requests

OCI pull requests use OCIDs rather than numeric IDs.
Renovate derives stable numeric identifiers internally; these are not OCI PR numbers.

Configure `reviewers` with OCI user OCIDs, not usernames or IAM group names.
OCI does not permit the PR author to be a reviewer; the adapter skips that identity and warns.
Existing reviewers are preserved, and repeated additions do not create duplicates.
Inline review comments, replies, and comments authored by other users are not modified or removed by comment management.

Reopening happens before metadata updates because OCI rejects metadata updates on closed PRs.
State is refreshed after interrupted updates, so the next run can recover without repeating a completed state transition.

## Limitations

- Issues and the Dependency Dashboard are unavailable
- Draft pull requests, labels, and assignees are unavailable
- Commit status checks, branch automerge, PR automerge, and platform automerge are not supported
- Fork creation and cross-repository pull requests are not supported

Branch status is reported as pending, never assumed successful.
Branch automerge is rejected even when `ignoreTests` is enabled.
Incoming pull requests from other source repositories are excluded from PR lookup.
Configured labels are ignored with a warning when a PR operation tries to apply them.
Attempts to use assignees, automerge, or the Dependency Dashboard also warn rather than claiming success.
Draft PR creation is rejected instead of silently publishing a non-draft PR.
Leave these features disabled; CI integration and automatic merging are not implemented.

Start with `dryRun: 'full'` to verify extraction and update selection without pushing branches or creating pull requests.

## Troubleshooting

- **Git authentication failure:** API signing credentials and Git credentials are separate; verify the selected HTTPS token or registered SSH key independently
- **401 or 403:** verify the API profile, signing key, region, and IAM permissions; a 404 can also mean the caller cannot access the resource
- **400 when adding reviewers:** use user OCIDs and select someone other than the PR author
- **409 during PR updates:** refresh PR state before retrying; closed PRs must be reopened before changing their metadata
- **429 or 5xx:** treated as external platform failures rather than missing repository data; retain the logged `opcRequestId` for Oracle Support
- **PR creation returns `500 InternalError`:** check the project notification topic and repository dynamic-group policy, then reproduce through the OCI Console to distinguish setup or service problems from client-specific failures

The notification and IAM checks are troubleshooting steps, not proof of the cause of every server error.
API warnings include status codes and OCI request IDs without logging signed authorization headers or request bodies.
PR POST requests carry an OCI retry token, and repeated pagination tokens are rejected instead of looping indefinitely.
Always verify that a PR exists after a real run: a successful process exit by itself does not prove that PR creation succeeded.
