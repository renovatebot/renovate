# Job Scheduling & Renovate Status

Mend Renovate Cloud will automatically schedule Renovate jobs to be run on installed repos.
When the scheduler runs, selected repositories are added to the Job Queue, and eventually executed by the job runners.

## Job Schedulers

There are four types of job schedulers, each with a different frequency and selection of repositories.

|                            | Frequency    | Renovate statuses             |
|----------------------------|--------------|-------------------------------|
| Active jobs (Hot)          | 4-hourly (1) | new, activated                |
| Inactive jobs (Cold)       | Daily        | onboarded, onboarding, failed |
| Blocked                    | Weekly       | resource-limit, timeout       |
| All repos                  | Monthly      | All enabled repos             |
(1) Renovate Enterprise jobs are scheduled every hour for repositories on GitHub and Azure DevOps.

## Renovate Statuses

Each repository installed with Renovate Cloud has a Renovate Status. The Renovate Status is used by the job scheduler to determine which repositories will be selected.
The status appears in the list of repositories shown on the Org page of the Developer Portal.

The table below describes all the Renovate statuses.

| Renovate Status      | Description                                           | Schedule |
|----------------------|-------------------------------------------------------|----------|
| <-blank->            | New repo. Renovate has never run on this repo.        | Active   |
| onboarding           | Onboarding PR has not been merged                     | Inactive |
| onboarded            | Onboarding PR has been merged. No Renovate PRs merged | Inactive |
| activated            | At least one Renovate PR has been merged              | Active   |
| silent               | Renovate will run, but not deliver PRs or issues      | Inactive |
| disabled             | Renovate will not run on this repository              | [ None ] |
| failed               | An error occurred while running the last job          | Inactive |
| timeout              | A timeout occurred while running the last job         | Blocked  |
| kernel-out-of-memory | An OOM error occurred while running the last job      | Blocked  |
| resource-limit       | A resource limit was hit while running the last job   | Blocked  |
| unknown              | An unknown error occurred while running the last job  | Blocked  |
