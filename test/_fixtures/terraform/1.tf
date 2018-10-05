module "foo" {
  source  = "github.com/hashicorp/example?ref=v1.0.0"
}

module "bar" {
  source  = "github.com/hashicorp/example?ref=next"
}

module "consul" {
  source = "hashicorp/consul/aws"
  version = "0.1.0"
}
