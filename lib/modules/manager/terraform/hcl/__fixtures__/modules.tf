module "foo" {
  source = "github.com/hashicorp/example?ref=v1.0.0"
}

module "bar" {
  source = "github.com/hashicorp/example?ref=next"
}

module "repo-with-non-semver-ref" {
  source = "github.com/githubuser/myrepo//terraform/modules/moduleone?ref=tfmodule_one-v0.0.9"
}

module "repo-with-dot" {
  source = "github.com/hashicorp/example.2.3?ref=v1.0.0"
}

module "repo-with-dot-and-git-suffix" {
  source = "github.com/hashicorp/example.2.3.git?ref=v1.0.0"
}

module "consul" {
  source  = "hashicorp/consul/aws"
  version = "0.1.0"
}
