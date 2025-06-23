terraform {
  required_providers {
    aws = {
      source  = "aws"
      version = "~> 3.0"
    }
    azurerm = {
      version = "~> 2.50.0"
    }
    kubernetes = {
      source  = "terraform.example.com/example/kubernetes"
      version = ">= 1.0"
    }
  }
}
