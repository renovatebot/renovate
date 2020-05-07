module "foo" {
  source = "github.com/hashicorp/example?ref=v1.0.0"
}

module "bar" {
  source = "github.com/hashicorp/example?ref=next"
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

module "container_definition" {
  source         = "github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?ref=v0.1.0"
  name           = "hello"
  image          = "tutum/hello-world"
  mem_soft_limit = 256
  port_mappings = [{
    containerPort = 80
    hostPort      = 80
  }]
}

module "task_definition" {
  source = "github.com/tieto-cem/terraform-aws-ecs-task-definition?ref=v0.1.0"
  name   = "mytask"
  container_definitions = [
  "${module.container_definition.json}"]
}
module "consul" {
  source = "git@github.com:hashicorp/example.git?ref=v2.0.0"
}

module "web_server_sg" {
  source = "terraform-aws-modules/security-group/aws//modules/http-80"

  name        = "web-server"
  description = "Security group for web-server with HTTP ports open within VPC"
  vpc_id      = "vpc-12345678"

  ingress_cidr_blocks = ["10.10.0.0/16"]
}

module "vote_service_sg" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "<= 2.4.0"

  name        = "user-service"
  description = "Security group for user-service with custom ports open within VPC, and PostgreSQL publicly open"
  vpc_id      = "vpc-12345678"

  ingress_cidr_blocks = ["10.10.0.0/16"]
  ingress_rules       = ["https-443-tcp"]
  ingress_with_cidr_blocks = [
    {
      from_port   = 8080
      to_port     = 8090
      protocol    = "tcp"
      description = "User-service ports"
      cidr_blocks = "10.10.0.0/16"
    },
    {
      rule        = "postgresql-tcp"
      cidr_blocks = "0.0.0.0/0"
    },
  ]
}

module "consul" {
  source  = "app.terraform.io/example-corp/k8s-cluster/azurerm"
  version = "~> 1.1.0"
}

module "consul2" {
  source  = "app.terraform.io/example-corp/k8s-cluster/azurerm"
  version = "~> 1.1"
}

module "consul3" {
  source  = "app.terraform.io/example-corp/k8s-cluster/azurerm"
  version = "~~ 1.1"
}

module "consul3" {
  source  = "hashicorp/consul/aws"
  version = ">= 1.0.0, <= 2.0.0"
}

module "relative" {
  source = "../../modules/fe"
}

module "nosauce" {
  foo = "bar"
}

# test exact without operator, equal with `=`
provider "azurerm" {
  version = "1.36.1"
}

provider "gitlab" {
  alias   = "main"
  version = "=2.4"
}

provider "gitlab" {
  token   = "${var.gitlab_token}"
  version = "=1.3"
}

provider "helm" {
  kubernetes {
    host     = "https://104.196.242.174"
    username = "ClusterMaster"
    password = "MindTheGap"

    client_certificate     = file("~/.kube/client-cert.pem")
    client_key             = file("~/.kube/client-key.pem")
    cluster_ca_certificate = file("~/.kube/cluster-ca-cert.pem")
  }
}

provider "newrelic" {
  version = "V1.9"

  api_key = "${var.newrelic_api_key}"
}

module "foobar" {
  source = "https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

module "gittags" {
  source = "git::https://bitbucket.com/hashicorp/example?ref=v1.0.0"
}

module "gittags_badversion" {
  source = "git::https://bitbucket.com/hashicorp/example?ref=next"
}
