module "foobar" {
  source = "git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository?ref=v1.0.0"
}

module "gittags" {
  source = "git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository?ref=v1.0.0"
}

module "gittags_subdir" {
  source = "git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository//some-module/path?ref=v1.0.0"
}
