/*
 * Data sources.
 */

data "aws_region" "current" {}

/*
 * Locals.
 */

locals {
}

/*
 * Terraform resources.
 */

resource "aws_security_group" "cloudfront_sg" {
  count = 3

  description = "Allow incoming traffic from CloudFront"
  name        = "cloudfront-sg-${count.index}"
  vpc_id      = var.vpc_id

  tags = {
    "Name" = "cloudfront-sg-${count.index}"
  }
}

module "cloudfront_sg_lambda" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 1.0"

  function_name = "${var.name}-cloudfront-sg"
  description   = "Automatically update security groups for Amazon CloudFront IP ranges"
  handler       = "handler.main"
  runtime       = "nodejs12.x"
  timeout       = 120

  publish = false

  create_package         = false
  local_existing_package = "dist/cloudfront-sg-lambda.zip"

  create_current_version_allowed_triggers   = false
  create_unqualified_alias_allowed_triggers = true

  attach_policy_statements = true
  policy_statements = {
    ec2_permissions = {
      effect = "Allow",
      actions = [
        "ec2:DescribeSecurityGroups",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:CreateSecurityGroup",
        "ec2:DescribeVpcs",
        "ec2:CreateTags",
        "ec2:ModifyNetworkInterfaceAttribute",
        "ec2:DescribeNetworkInterfaces",
      ],
      resources = ["*"]
    }
  }

  # attach_network_policy  = true
  # vpc_subnet_ids         = var.subnet_ids
  # vpc_security_group_ids = var.vpc_security_group_ids
  vpc_security_group_ids = aws_security_group.cloudfront_sg.*.id

  environment_variables = {
    AWS_SERVICE_FILTER = "CLOUDFRONT"
    SECURITY_GROUP_IDS = jsonencode(aws_security_group.cloudfront_sg.*.id)
    SERVICE_PORTS      = "[80]"
  }

  tags = var.tags
}
