resource "tfe_workspace" "test_workspace" {
  name         = "test-workspace"
  organization = "renovate-fixtures"

  terraform_version = "1.1.6"
}

resource "tfe_workspace" "test_workspace" {
  name         = "test-workspace"
  organization = "renovate-fixtures"
}

resource "tfe_workspace" "workspace_with_block" {
  vcs_repo {
    identifier         = "organization/repository"
    oauth_token_id     = "invalidToken"
  }

  name         = "lifecycle-workspace"
  organization = "renovate-fixtures"

  terraform_version = "1.1.9"
}
