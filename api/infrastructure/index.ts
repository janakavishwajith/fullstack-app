import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as crypto from "crypto"
import { uploadFrontend, packageLambda, updateFrontendConfig } from "./util";

// Create DynamoDB table for the users
const dynamoTable = new aws.dynamodb.Table("serverlessFullstack-api-DynamoDB", {
  attributes: [
    {
      name: "hk",
      type: "S"
    },
    {
      name: "sk",
      type: "S"
    },
    {
      name: "sk2",
      type: "S"
    }
  ],
  hashKey: "hk",
  rangeKey: "sk",
  globalSecondaryIndexes: [{
    name: "gs1",
    hashKey: "sk2",
    rangeKey: "sk",
    projectionType: "ALL"
  }],
  billingMode: "PAY_PER_REQUEST"
})

// Create IAM Role for Lambda
const lambdaRole = new aws.iam.Role("serverlessFullstack-api-lambdaRole", {
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        Service: "lambda.amazonaws.com"
      }
    }]
  }
})

// Create the Lambda function
const lambdaFunc = new aws.lambda.Function("serverlessFullstack-api-lambdaFunc", {
  role: lambdaRole.arn,
  runtime: "nodejs14.x",
  handler: "app.handler",
  code: new pulumi.asset.FileArchive(packageLambda()),
  environment: {
    variables: {
      db: dynamoTable.name,
      dbIndex1: dynamoTable.globalSecondaryIndexes.apply(indexes => (indexes && indexes[0])?.name ?? "gs1"),
      tokenSecret: pulumi.secret(crypto.randomBytes(64).toString("hex"))
    }
  }
}, {
  parent: lambdaRole,
  dependsOn: [ dynamoTable ]
})

export const lambdaEnvironment = lambdaFunc.environment.apply(env => env?.variables)

// Add policy for accessing DynamoDB for the Lambda
new aws.iam.RolePolicy("serverlessFullstack-api-rolePolicy-DynamoDB", {
  role: lambdaRole,
  policy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ],
        Resource: dynamoTable.arn
      },
      {
        Effect: "Allow",
        Action: [
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Resource: dynamoTable.arn.apply(arn => `${arn}/index/*`)
      }
    ]
  }
}, {
  parent: lambdaFunc
})

// Attach monitoring policies to Lambda
new aws.iam.RolePolicyAttachment("serverlessFullstack-api-rolePolicyAttachment-Lambda", {
  role: lambdaRole,
  policyArn: aws.iam.ManagedPolicies.AWSLambdaExecute
}, {
  parent: lambdaFunc
})

new aws.iam.RolePolicyAttachment("serverlessFullstack-api-rolePolicyAttachment-CloudWatch-FullAccess", {
  role: lambdaRole,
  policyArn: aws.iam.ManagedPolicies.CloudWatchFullAccess
}, {
  parent: lambdaFunc
})

new aws.iam.RolePolicyAttachment("serverlessFullstack-api-rolePolicyAttachment-CloudWatch-EventsFullAccess", {
  role: lambdaRole,
  policyArn: aws.iam.ManagedPolicies.CloudWatchEventsFullAccess
}, {
  parent: lambdaFunc
})

new aws.iam.RolePolicyAttachment("serverlessFullstack-api-rolePolicyAttachment-XRay-WriteOnlyAccess", {
  role: lambdaRole,
  policyArn: aws.iam.ManagedPolicies.AWSXrayWriteOnlyAccess
}, {
  parent: lambdaFunc
})

// Create API Gateway
const apiGateway = new aws.apigatewayv2.Api("serverlessFullstack-api-gateway", {
  protocolType: "HTTP"
}, { parent: lambdaRole })

new aws.lambda.Permission("serverlessFullstack-api-gateway-lambdaPermission", {
  action: "lambda:InvokeFunction",
  principal: "apigateway.amazonaws.com",
  function: lambdaFunc,
  sourceArn: pulumi.interpolate`${apiGateway.executionArn}/*/*`
}, { parent: apiGateway })

const integration = new aws.apigatewayv2.Integration("serverlessFullstack-api-gateway-lambdaIntegration", {
  apiId: apiGateway.id,
  integrationType: "AWS_PROXY",
  integrationUri: lambdaFunc.arn,
  integrationMethod: "ANY",
  payloadFormatVersion: "2.0",
  passthroughBehavior: "WHEN_NO_MATCH"
}, { parent: apiGateway })

const route = new aws.apigatewayv2.Route("serverlessFullstack-api-gateway-route", {
  apiId: apiGateway.id,
  routeKey: "$default",
  target: pulumi.interpolate`integrations/${integration.id}`
}, { parent: apiGateway })

new aws.apigatewayv2.Stage("serverlessFullstack-api-gateway-stage", {
  apiId: apiGateway.id,
  name: "$default",
  routeSettings: [{
    routeKey: route.routeKey,
    throttlingBurstLimit: 5000,
    throttlingRateLimit: 10000
  }],
  autoDeploy: true
}, { parent: apiGateway })

// Update endpoint to frontend config & export endpoint to outputs
export const apiEndpoint = pulumi.interpolate`${apiGateway.apiEndpoint}/`
  .apply(apiEndpoint => {
    updateFrontendConfig(apiEndpoint)
    return apiEndpoint
  })

// Create a S3 bucket for the front-end application
const frontendBucket = new aws.s3.Bucket("serverlessFullstack-frontend-bucket", {
  website: {
    indexDocument: "index.html",
    errorDocument: "index.html"
  },
  forceDestroy: true
}, {
  dependsOn: [ apiGateway ]
})

// Upload frontend to S3 bucket & export bucket name to outputs
// * It's also a trick to make pulumi wait for upload
export const bucketName = frontendBucket.bucket.apply(async bucketName => {
  if(!process.env.SKIP_FRONTEND_UPLOAD && !pulumi.runtime.isDryRun())
    await uploadFrontend(bucketName)
  
  return bucketName
})

// Create Origin Access Identity for CloudFront
const frontendOriginAccessIdentity = new aws.cloudfront.OriginAccessIdentity("serverlessFullstack-frontend-cloudfront-originAccessIdentity", {
  comment: frontendBucket.bucket
}, {
  parent: frontendBucket,
})

new aws.s3.BucketPolicy("serverlessFullstack-frontend-bucket-policy", {
  bucket: frontendBucket.id,
  policy: {
    Version: "2012-10-17",
    Statement: [{
      Action: [ "s3:GetObject" ],
      Effect: "Allow",
      Resource: [ frontendBucket.arn.apply(arn => `${arn}/*`) ],
      Principal: {
        AWS: frontendOriginAccessIdentity.iamArn
      }
    }]
  }
}, {
  parent: frontendBucket
})

// Create CloudFront Distribution
const cloudfrontS3OriginName = "frontendBucketOrigin"
const frontendDistribution = new aws.cloudfront.Distribution("serverlessFullstack-frontend-cloudfront-distribution", {
  defaultCacheBehavior: {
    allowedMethods: [ "GET", "HEAD", "OPTIONS" ],
    cachedMethods: [ "GET", "HEAD", "OPTIONS" ],
    compress: true,
    minTtl: 0,
    defaultTtl: 3600,
    maxTtl: 31536000,
    targetOriginId: cloudfrontS3OriginName,
    viewerProtocolPolicy: "redirect-to-https",
    forwardedValues: {
      queryString: false,
      cookies: {
        forward: "none"
      }
    }
  },
  customErrorResponses: [
    { errorCode: 403, responseCode: 200, responsePagePath: "/index.html" },
    { errorCode: 404, responseCode: 200, responsePagePath: "/index.html" }
  ],
  enabled: true,
  httpVersion: "http2",
  defaultRootObject: "index.html",
  origins: [{
    domainName: frontendBucket.bucketRegionalDomainName,
    originId: cloudfrontS3OriginName,
    s3OriginConfig: {
      originAccessIdentity: frontendOriginAccessIdentity.cloudfrontAccessIdentityPath
    }
  }],
  restrictions: {
    geoRestriction: {
      restrictionType: "none"
    }
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true
  }
}, {
  parent: frontendBucket
})

export const frontendUrl = frontendDistribution.domainName
