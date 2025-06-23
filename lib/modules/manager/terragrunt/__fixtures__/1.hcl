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

  source = "tfr:///myuser/myrepo/cloud//folder/modules/moduleone?ref=v0.0.9"

  after_hook "after_hook" {
    commands     = ["apply", "plan"]
    execute      = ["echo", "Finished running Terraform"]
    run_on_error = true
  }
}

#submodule
terraform {
  source = "tfr:///terraform-google-modules/kubernetes-engine/google//modules/private-cluster?version=1.2.3"
}

#bar
terraform {
  source = "tfr:///terraform-aws-modules/vpc/aws?version=3.3.0"
}

#missing third backslash
terraform {
  source = "tfr://terraform-aws-modules/vpc/aws?version=3.3.0"
}

#with domain
terraform {
  source = "tfr://registry.domain.com/abc/helloworld/aws?version=1.0.0"
}
