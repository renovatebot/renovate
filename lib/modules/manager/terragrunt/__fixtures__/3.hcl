#real
terraform {
  extra_arguments "common_vars" {
    commands = ["plan", "apply"]

    arguments = [
      "-var-file=../../common.tfvars",
      "-var-file=../region.tfvars"
    ]
  }

  before_hook "before_hook" {
    commands     = ["apply", "plan"]
    execute      = ["echo", "Running Terraform"]
  }

  source = "github.com/myuser/myrepo//folder/modules/moduleone?ref=v0.0.9&depth=1"

  after_hook "after_hook" {
    commands     = ["apply", "plan"]
    execute      = ["echo", "Finished running Terraform"]
    run_on_error = true
  }
}

#foo
terraform {
  source = "github.com/hashicorp/example?ref=v1.0.0&depth=1"
}

#bar
terraform {
  source = "github.com/hashicorp/example?ref=next&depth=3"
}

#IP
terraform {
  source = "https://104.196.242.174/example?ref=next&depth=1"
}

#local hostname
terraform {
  source = "my.host.local/example?ref=v1.2.1&depth=1"
}

#local hostname
terraform {
  source = "my.host/modules/test"
}

#local hostname
terraform {
  source = "my.host/modules/test?ref=v1.2.1&depth=1"
}

#local hostname
terraform {
  source = "my.host"
}

#local hostname
terraform {
  source = "my.host.local/sources/example?ref=v1.2.1&depth=1"
}

#hostname
terraform {
  source = "my.host/example?ref=next&depth=1"
}

#invalid
terraform {
  source = "//terraform/module/test?ref=next&depth=1"
}

#repo-with-non-semver-ref
terraform {
  source = "github.com/githubuser/myrepo//terraform/modules/moduleone?ref=tfmodule_one-v0.0.9&depth=1"
}

#repo-with-dot
terraform {
  source = "github.com/hashicorp/example.2.3?ref=v1.0.0&depth=1"
}

#repo-with-dot-and-git-suffix
terraform {
  source = "github.com/hashicorp/example.2.3.git?ref=v1.0.0&depth=1"
}

#source without pinning
terraform {
  source  = "hashicorp/consul/aws"
}

# source with double-slash
terraform {
  source         = "github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?ref=v0.1.0&depth=1"
}

# regular sources
terraform {
  source = "github.com/tieto-cem/terraform-aws-ecs-task-definition?ref=v0.1.0&depth=1"
}

terraform {
  source = "git@github.com:hashicorp/example.git?ref=v2.0.0&depth=1"
}

terraform {
  source = "terraform-aws-modules/security-group/aws//modules/http-80"

}

terraform {
  source  = "terraform-aws-modules/security-group/aws"
}

terraform {
  source = "../../terraforms/fe"
}

# nosource, ignored by test since it does not have source on the next line
terraform {
  foo = "bar"
}

# foobar
terraform {
  source = "https://mygit.com/hashicorp/example?ref=v1.0.0&depth=1"
}

# gittags
terraform {
  source = "git::https://mygit.com/hashicorp/example?ref=v1.0.0&depth=1"
}

# gittags_badversion
terraform {
  source = "git::https://mygit.com/hashicorp/example?ref=next&depth=1"
}

# gittags_subdir
terraform {
  source = "git::https://mygit.com/hashicorp/example//subdir/test?ref=v1.0.1&depth=1"
}

# gittags_http
terraform {
  source = "git::http://mygit.com/hashicorp/example?ref=v1.0.2&depth=1"
}

# gittags_ssh
terraform {
  source = "git::ssh://git@mygit.com/hashicorp/example?ref=v1.0.3&depth=1"
}

# invalid, ignored by test since it does not have source on the next line
terraform {
}

# unsupported terragrunt, ignored by test since it does not have source on the next line
terraform {
  name  = "foo"
  dummy = "true"
}

# bitbucket-tags
terraform {
  source = "git::https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

# gitlab-tags
terraform {
  source = "git::https://gitlab.com/hashicorp/example?ref=v1.0.0"
}

# gitea-tags
terraform {
  source = "git::https://gitea.com/hashicorp/example?ref=v1.0.0"
}

