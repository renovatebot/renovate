#foo
terraform {
  source = "github.com/hashicorp/example?ref=v1.0.0"
}

#bar
terraform {
  source = "github.com/hashicorp/example?ref=next"
}

#repo-with-non-semver-ref
terraform {
  source = "github.com/githubuser/myrepo//terraform/modules/moduleone?ref=tfmodule_one-v0.0.9"
}

#repo-with-dot
terraform {
  source = "github.com/hashicorp/example.2.3?ref=v1.0.0"
}

#repo-with-dot-and-git-suffix
terraform {
  source = "github.com/hashicorp/example.2.3.git?ref=v1.0.0"
}

#source without pinning
terraform {
  source  = "hashicorp/consul/aws"
}

# source with double-slash
terraform {
  source         = "github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?ref=v0.1.0"
}

# regular sources
terraform {
  source = "github.com/tieto-cem/terraform-aws-ecs-task-definition?ref=v0.1.0"
}

terraform {
  source = "git@github.com:hashicorp/example.git?ref=v2.0.0"
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

# nosource
terraform {
  foo = "bar"
}

# foobar
terraform {
  source = "https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

# gittags
terraform {
  source = "git::https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

# gittags_badversion
terraform {
  source = "git::https://bitbucket.com/hashicorp/example?ref=next"
}

# gittags_subdir
terraform {
  source = "git::https://bitbucket.com/hashicorp/example//subdir/test?ref=v1.0.1"
}

# gittags_http
terraform {
  source = "git::http://bitbucket.com/hashicorp/example?ref=v1.0.2"
}

# gittags_ssh
terraform {
  source = "git::ssh://git@bitbucket.com/hashicorp/example?ref=v1.0.3"
}

# invalid
terraform {
}

# unsupported terragrunt
terraform {
  name  = "foo"
  dummy = "true"
}
