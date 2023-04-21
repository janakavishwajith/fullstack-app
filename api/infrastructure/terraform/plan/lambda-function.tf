resource "aws_dynamodb_table" "serverlessFullstack-api-DynamoDB" {
  name           = "serverlessFullstack-api-DynamoDB"
  billing_mode   = "PAY_PER_REQUEST"

  attribute {
    name = "hk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "sk2"
    type = "S"
  }

  hash_key = "hk"

  range_key = "sk"

  global_secondary_index {
    name               = "gs1"
    hash_key           = "sk2"
    range_key          = "sk"
    projection_type    = "ALL"
  }
}


resource "aws_iam_role" "serverlessFullstack-api-lambdaRole" {
  name = "serverlessFullstack-api-lambdaRole"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy" "serverlessFullstack-rolePolicy-DynamoDB" {
  name = "serverlessFullstack-rolePolicy-DynamoDB"
  role = aws_iam_role.serverlessFullstack-api-lambdaRole.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ]
        Resource = aws_dynamodb_table.serverlessFullstack-api-DynamoDB.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = "${aws_dynamodb_table.serverlessFullstack-api-DynamoDB.arn}/index/*"
      },
    ]
  })
  
}


resource "aws_iam_role_policy_attachment" "serverlessFullstack-api-lambdaRole_policy" {
  role       = aws_iam_role.serverlessFullstack-api-lambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "serverlessFullstack-api-rolePolicyAttachment-CloudWatch-FullAccess" {
  role       = aws_iam_role.serverlessFullstack-api-lambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchFullAccess"
}

resource "aws_iam_role_policy_attachment" "serverlessFullstack-api-rolePolicyAttachment-CloudWatch-EventsFullAccess" {
  role       = aws_iam_role.serverlessFullstack-api-lambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchEventsFullAccess"
}

resource "aws_iam_role_policy_attachment" "serverlessFullstack-api-rolePolicyAttachment-XRay-WriteOnlyAccess" {
  role       = aws_iam_role.serverlessFullstack-api-lambdaRole.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
}

resource "aws_lambda_function" "serverlessFullstack-api-lambdaFunc" {
  function_name = "serverlessFullstack-api-lambdaFunc"

  s3_bucket = aws_s3_bucket.lambda_bucket.id
  s3_key    = aws_s3_object.serverless_lambda.key

  runtime = "nodejs14.x"
  handler = "app.handler"
  depends_on = [aws_dynamodb_table.serverlessFullstack-api-DynamoDB]

  environment {
    variables = {
      db         = aws_dynamodb_table.serverlessFullstack-api-DynamoDB.name
      dbIndex1   = "gs1"
      tokenSecret = random_password.lambdaTokenSecret.result
    }
  }

  # source_code_hash = data.archive_file.serverless_lambda.output_base64sha256

  role = aws_iam_role.serverlessFullstack-api-lambdaRole.arn
}

resource "random_password" "lambdaTokenSecret" {
  length  = 64
  special = false
}

resource "aws_cloudwatch_log_group" "serverlessFullstack-api-lambdaFunc" {
  name = "/aws/lambda/${aws_lambda_function.serverlessFullstack-api-lambdaFunc.function_name}"

  retention_in_days = 14
}

# data "archive_file" "serverless_lambda" {
#   type = "zip"

#   source_dir  = "../"
#   output_path = "../terraform/serverless_lambda.zip"
#   excludes = ["coverage", "cypress", "infrastructure", "models", "terraform","tests"]
# }

variable "lambda_location" {
  type = string
}

resource "aws_s3_object" "serverless_lambda" {
  bucket = aws_s3_bucket.lambda_bucket.id

  key    = "fullstack-api.zip"
  # source = data.archive_file.serverless_lambda.output_path
  # source = "../.serverless/fullstack-api.zip"
  source = var.lambda_location

  # etag = filemd5(data.archive_file.serverless_lambda.output_path)
  # etag = filemd5("../.serverless/fullstack-api.zip")
  etag = filemd5(var.lambda_location)
}

resource "aws_apigatewayv2_api" "serverlessFullstack-api-gateway" {
  name          = "serverlessFullstack-api-gateway"
  protocol_type = "HTTP"
}

resource "aws_lambda_permission" "serverlessFullstack-api-gateway-lambdaPermission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.serverlessFullstack-api-lambdaFunc.arn
  principal     = "apigateway.amazonaws.com"
}

resource "aws_apigatewayv2_integration" "serverlessFullstack-api-gateway-lambdaIntegration" {
  api_id               = aws_apigatewayv2_api.serverlessFullstack-api-gateway.id
  integration_type     = "AWS_PROXY"
  integration_uri      = aws_lambda_function.serverlessFullstack-api-lambdaFunc.invoke_arn
  integration_method   = "POST"
  payload_format_version = "2.0"
  passthrough_behavior = "NEVER"
}

resource "aws_apigatewayv2_route" "serverlessFullstack-api-gateway-route" {
  api_id    = aws_apigatewayv2_api.serverlessFullstack-api-gateway.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.serverlessFullstack-api-gateway-lambdaIntegration.id}"
}

resource "aws_apigatewayv2_stage" "serverlessFullstack-api-gateway-stage" {
  api_id = aws_apigatewayv2_api.serverlessFullstack-api-gateway.id
  name = "$default"
  route_settings {
    route_key = aws_apigatewayv2_route.serverlessFullstack-api-gateway-route.route_key
    throttling_burst_limit = 5000
    throttling_rate_limit = 10000
  }
  auto_deploy = true
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.serverlessFullstack-api-gateway.api_endpoint
}
output "db_table" {
  value = aws_dynamodb_table.serverlessFullstack-api-DynamoDB.name
}
output "db_table_index" {
  # value = "{'name': 'gs1','hash_key' : 'sk2','range_key': 'sk','projection_type': 'ALL'}"
  value = "gs1"
}

output "token_secret" {
  value = aws_lambda_function.serverlessFullstack-api-lambdaFunc.environment[0].variables.tokenSecret
  sensitive = true
}