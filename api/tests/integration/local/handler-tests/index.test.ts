/**
 * This file shows an alternate way to integration test
 * the application, by calling the Lambda handler itself
 * instead of the Express application.
 */

import * as serverless from "serverless-http"
import { setupApp } from "../../../../app"
import AWS = require("aws-sdk")
import AWSMock = require("aws-sdk-mock")
import { generate } from "shortid"
import * as bcrypt from "bcryptjs"
import * as jwt from "jsonwebtoken"
import { users as usersModel } from "../../../../models"
import { APIGatewayProxyEventV2, Context } from "aws-lambda"
import shortid = require("shortid")

const testEnv = { ...process.env }
const tokenSecret = "test"

let handler = serverless(setupApp())

beforeEach(() => {
  jest.resetModules()
  process.env.db = "test"
  process.env.tokenSecret = tokenSecret

  AWSMock.setSDKInstance(AWS)
  // Reset app instance to inject environment
  handler = serverless(setupApp())
})

afterEach(() => {
  process.env = { ...testEnv }

  AWSMock.restore()
})

const validCredentials = {
  email: "test@test.com",
  password: "test"
}

const validUserEntity = {
  hk: validCredentials.email,
  sk: "user",
  sk2: generate(),
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
  password: bcrypt.hashSync(validCredentials.password, 10)
}

const createLambdaEventContext = (path: string, method: string, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const routeKey = "$default"
  const requestId = shortid.generate()
  const event: APIGatewayProxyEventV2 = {
    version: "2.0",
    routeKey,
    rawPath: path,
    rawQueryString: "",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "test.test.com",
      domainPrefix: "test",
      http: {
        method: method,
        path: path,
        protocol: "HTTP/1.1",
        sourceIp: "IP",
        userAgent: "agent"
      },
      requestId,
      routeKey,
      stage: routeKey,
      time: new Date().toISOString(),
      timeEpoch: Date.now()
    },
    body: JSON.stringify(body),
    isBase64Encoded: false
  }
  const context: Context = {
    functionName: "testLambda",
    functionVersion: "1",
    callbackWaitsForEmptyEventLoop: false,
    memoryLimitInMB: "100",
    awsRequestId: requestId,
    invokedFunctionArn: "",
    logGroupName: "",
    logStreamName: "",
    getRemainingTimeInMillis: jest.fn(() => 1000),
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  }

  return {
    event,
    context
  }
}

describe("/users/login", () => {
  it("Succeeds with valid credentials", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    const { event, context } = createLambdaEventContext("/users/login", "POST", validCredentials)

    const result = await handler(event, context)
    const body = JSON.parse(result?.body ?? "")

    expect(result.statusCode).toEqual(200)
    expect(body).toEqual(expect.objectContaining({
      message: "Authentication successful",
      token: expect.any(String)
    }))

    expect(jwt.verify(body?.token as string, tokenSecret))
      .toMatchObject(validUserEntity)
  })

  it("Fails when user doesn't exist", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: []
    }))

    const { event, context } = createLambdaEventContext("/users/login", "POST", validCredentials)

    const result = await handler(event, context)
    const body = JSON.parse(result?.body ?? "")

    expect(result.statusCode).toEqual(404)
    expect(body).toHaveProperty("error", "Authentication failed. User not found.")
  })

  it("Fails when password doesn't match", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    const { event, context } = createLambdaEventContext("/users/login", "POST", {
      ...validCredentials,
      password: "invalidpassword"
    })

    const result = await handler(event, context)
    const body = JSON.parse(result?.body ?? "")

    expect(result.statusCode).toEqual(401)
    expect(body).toHaveProperty("error", "Authentication failed. Wrong password.")
  })
})

describe("/users/register", () => {
  it("Succeeds with valid credentials", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb (null, {}))
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
      cb(null, { Items: [] })

      // Update mock to return valid user on next query
      AWSMock.remock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
        Items: [ validUserEntity ]
      }))
    })

    const { event, context } = createLambdaEventContext("/users/register", "POST", validCredentials)

    const result = await handler(event, context)
    const body = JSON.parse(result?.body ?? "")

    expect(result.statusCode).toEqual(200)
    expect(body).toEqual(expect.objectContaining({
      message: "Authentication successful",
      token: expect.any(String)
    }))
  })

  it("Fails with invalid account details", async () => {
    const { event: emptyEvent, context: emptyContext } = createLambdaEventContext("/users/register", "POST", {})
    const { event: emailEvent, context: emailContext } = createLambdaEventContext("/users/register", "POST", { email: "test@test.com" })
    const { event: invalidEvent, context: invalidContext } = createLambdaEventContext("/users/register", "POST", { email: "test", password: "test" })

    await Promise.all([
      handler(emptyEvent, emptyContext)
        .then(result => {
          const body = JSON.parse(result.body ?? "")

          expect(result.statusCode).toEqual(400)
          expect(body).toHaveProperty("error", '"email" is required')
        }),
      handler(emailEvent, emailContext)
        .then(result => {
          const body = JSON.parse(result.body ?? "")

          expect(result.statusCode).toEqual(400)
          expect(body).toHaveProperty("error", '"password" is required')
        }),
      handler(invalidEvent, invalidContext)
        .then(result => {
          const body = JSON.parse(result.body ?? "")

          expect(result.statusCode).toEqual(400)
          expect(body).toHaveProperty("error", '"test" is not a valid email address')
        })
    ])
  })

  it("Fails if email is registered", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    const { event, context } = createLambdaEventContext("/users/register", "POST", validCredentials)

    const result = await handler(event, context)
    const body = JSON.parse(result?.body ?? "")

    expect(result.statusCode).toEqual(400)
    expect(body).toHaveProperty("error", `A user with email "${validCredentials.email}" is already registered`)
  })
})

describe("/user", () => {
  const formattedUserEntity = usersModel.formatUserEntity(validUserEntity)
  const validToken = jwt.sign(formattedUserEntity, tokenSecret, {
    expiresIn: 60
  })
  const validHeader = { "authorization": `Bearer ${validToken}` }

  it("Succeeds if valid authorization token is sent", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    const { event, context } = createLambdaEventContext("/user", "POST", {}, validHeader)

    const result = await handler(event, context)
    const body = JSON.parse(result?.body ?? "")

    expect(result.statusCode).toEqual(200)
    expect(body).toEqual(expect.objectContaining({
      user: usersModel.convertToPublicFormat(formattedUserEntity)
    }))
  })

  it("Fails if user isn't in the database", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: []
    }))

    const { event, context } = createLambdaEventContext("/user", "POST", {}, validHeader)

    const result = await handler(event, context)

    expect(result.statusCode).toEqual(401)
  })

  it("Fails if user retrieval isn't possible", async () => {
    jest.spyOn(usersModel, "getById")
      .mockImplementationOnce(() => { throw new Error("Test") })

    const { event, context } = createLambdaEventContext("/user", "POST", {}, validHeader)

    const result = await handler(event, context)

    expect(result.statusCode).toEqual(500)
  })

  it("Fails without authorization header", async () => {
    const { event, context } = createLambdaEventContext("/user", "POST", {})

    const result = await handler(event, context)

    expect(result.statusCode).toEqual(401)
  })

  it("Fails with forged or expired token", async () => {    
    const forgedToken = jwt.sign(formattedUserEntity, "falseKey", {
      expiresIn: 60
    })

    const expiredToken = jwt.sign(formattedUserEntity, tokenSecret, {
      expiresIn: -60
    })

    const { context: forgedContext, event: forgedEvent}  = createLambdaEventContext("/user", "POST", {}, { "authorization": `Bearer ${forgedToken}` })
    const { context: expiredContext, event: expiredEvent } = createLambdaEventContext("/user", "POST", {}, { "authorization": `Bearer ${expiredToken}` })

    await Promise.all([
      handler(forgedEvent, forgedContext)
        .then(result => {
          expect(result.statusCode).toEqual(401)
        }),
      handler(expiredEvent, expiredContext)
        .then(result => {
          expect(result.statusCode).toEqual(401)
        })
    ])
  })
})
