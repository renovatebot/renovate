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

  source = "github.com/myuser/myrepo//folder/modules/moduleone?depth=1&ref=v0.0.9"

  after_hook "after_hook" {
    commands     = ["apply", "plan"]
    execute      = ["echo", "Finished running Terraform"]
    run_on_error = true
  }
}

#foo
terraform {
  source = "github.com/hashicorp/example?depth=5&ref=v1.0.0"
}

#bar
terraform {
  source = "github.com/hashicorp/example?depth=1&ref=next"
}

#IP
terraform {
  source = "https://104.196.242.174/example?depth=1&ref=next"
}

#local hostname
terraform {
  source = "my.host.local/example?depth=1&ref=v1.2.1"
}

#local hostname
terraform {
  source = "my.host/modules/test"
}

#local hostname
terraform {
  source = "my.host/modules/test?depth=1&ref=v1.2.1"
}

#local hostname
terraform {
  source = "my.host"
}

#local hostname
terraform {
  source = "my.host.local/sources/example?depth=1&ref=v1.2.1"
}

#hostname
terraform {
  source = "my.host/example?depth=1&ref=next"
}

#invalid
terraform {
  source = "//terraform/module/test?depth=1&ref=next"
}

#repo-with-non-semver-ref
terraform {
  source = "github.com/githubuser/myrepo//terraform/modules/moduleone?depth=1&ref=tfmodule_one-v0.0.9"
}

#repo-with-dot
terraform {
  source = "github.com/hashicorp/example.2.3?depth=1&ref=v1.0.0"
}

#repo-with-dot-and-git-suffix
terraform {
  source = "github.com/hashicorp/example.2.3.git?depth=1&ref=v1.0.0"
}

#source without pinning
terraform {
  source  = "hashicorp/consul/aws"
}

# source with double-slash
terraform {
  source         = "github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?depth=1&ref=v0.1.0"
}

# regular sources
terraform {
  source = "github.com/tieto-cem/terraform-aws-ecs-task-definition?depth=1&ref=v0.1.0"
}

terraform {
  source = "git@github.com:hashicorp/example.git?depth=1&ref=v2.0.0"
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
  source = "https://mygit.com/hashicorp/example?depth=1&ref=v1.0.0"
}

# gittags
terraform {
  source = "git::https://mygit.com/hashicorp/example?depth=1&ref=v1.0.0"
}

# gittags_badversion
terraform {
  source = "git::https://mygit.com/hashicorp/example?depth=1&ref=next"
}

# gittags_subdir
terraform {
  source = "git::https://mygit.com/hashicorp/example//subdir/test?depth=1&ref=v1.0.1"
}

# gittags_http
terraform {
  source = "git::http://mygit.com/hashicorp/example?depth=1&ref=v1.0.2"
}

# gittags_ssh
terraform {
  source = "git::ssh://git@mygit.com/hashicorp/example?depth=1&ref=v1.0.3"
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

