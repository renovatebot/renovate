resource "tfe_workspace" "test_workspace" {
  name         = "test-workspace"
  organization = "renovate-fixtures"

  terraform_version = "1.1.6"
}

resource "tfe_workspace" "test_workspace" {
  name         = "test-workspace"
  organization = "renovate-fixtures"
}
