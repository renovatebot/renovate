module "foobar" {
  source = "https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

module "gittags" {
  source = "git::https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

module "gittags_badversion" {
  source = "git::https://bitbucket.com/hashicorp/example?ref=next"
}

module "gittags_subdir" {
  source = "git::https://bitbucket.com/hashicorp/example//subdir/test?ref=v1.0.1"
}

module "gittags_http" {
  source = "git::http://bitbucket.com/hashicorp/example?ref=v1.0.2"
}

module "gittags_ssh" {
  source = "git::ssh://git@bitbucket.com/hashicorp/example?ref=v1.0.3"
}

module "bitbucket_ssh" {
  source = "git::ssh://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0"
}

module "bitbucket_https" {
  source = "git::https://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0"
}

module "bitbucket_plain" {
  source = "bitbucket.org/hashicorp/example.git?ref=v1.0.0"
}

module "bitbucket_subfolder" {
  source = "bitbucket.org/hashicorp/example.git/terraform?ref=v1.0.0"
}

module "bitbucket_subfolder_with_double_slash" {
  source = "bitbucket.org/hashicorp/example.git//terraform?ref=v1.0.0"
}
