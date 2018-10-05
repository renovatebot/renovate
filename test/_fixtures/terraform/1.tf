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

module "container_definition" {
  source         = "github.com/tieto-cem/terraform-aws-ecs-task-definition//modules/container-definition?ref=v0.1.0"
  name           = "hello"
  image          = "tutum/hello-world"
  mem_soft_limit = 256
  port_mappings  = [{
    containerPort = 80
    hostPort      = 80
  }]
}

module "task_definition" {
  source                = "github.com/tieto-cem/terraform-aws-ecs-task-definition?ref=v0.1.0"
  name                  = "mytask"
  container_definitions = [
    "${module.container_definition.json}"]
}
