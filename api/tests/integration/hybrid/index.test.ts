import * as shortid from "shortid"
import * as supertest from "supertest"
import * as automation from "../../../infrastructure/automation"
import * as jwt from "jsonwebtoken"
import { users as usersModel } from "../../../models"
import * as bcrypt from "bcryptjs"
import * as AWS from "aws-sdk"
import * as assert from "assert"
import { UserEntity } from "../../../types"
import { setupApp } from "../../../app"

const testEnv = { ...process.env }
const stackName = `test-integration-hybrid-${shortid.generate()}`
const testTimeout = 10000

let request: supertest.SuperTest<supertest.Test> | undefined = undefined
const tokenSecret = "test"

beforeAll(async () => {
  jest.resetModules()
  console.log(`Starting stack "${stackName}" deploy`)

  process.env.SKIP_LAMBDA = "true" // Deploy only DynamoDB to speed up tests
  process.env.SKIP_FRONTEND = "true"
  const outputs = await automation.deploy(stackName)

  console.log(`Stack "${stackName}" deployed`)

  const db = outputs?.dynamoTableName?.value
  const dbIndex1 = outputs?.dynamoTableSecondaryIndex?.value
  const AWS_REGION = await automation.getRegion()

  process.env = {
    ...process.env,
    db,
    dbIndex1,
    tokenSecret,
    AWS_REGION
  }

  // Assign supertest to point to the Express app
  request = supertest(setupApp())
}, 300000)

afterAll(async () => {
  console.log(`Starting stack "${stackName}" destroy`)
  await automation.destroy(stackName, true)
  console.log(`Stack "${stackName}" destroyed`)

  // Restore original environment
  process.env = { ...testEnv }
}, 300000)

// Define test credentials
const validCredentials = {
  email: "test@test.com",
  password: "test"
}

// Define test entity
const validUserEntity = {
  hk: validCredentials.email,
  sk: "user",
  sk2: shortid.generate(),
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
  password: bcrypt.hashSync(validCredentials.password, 10)
}

// Define util functions for tests
const getDynamoClient = async () => {
  const region = await automation.getRegion(stackName)
  return new AWS.DynamoDB.DocumentClient({
    region
  })
}

const putDynamoUser = async (user: UserEntity = validUserEntity) => {
  const db = process.env.db
  assert(db, "Environment not set")

  const dynamodb = await getDynamoClient()

  await dynamodb.put({
    TableName: db,
    Item: user
  }).promise()
}

const deleteDynamoUser = async (user: UserEntity = validUserEntity) => {
  const db = process.env.db
  assert(db, "Environment not set")

  const dynamodb = await getDynamoClient()

  await dynamodb.delete({
    TableName: db,
    Key: {
      hk: user.hk,
      sk: user.sk
    }
  }).promise()
}

describe("General API tests", () => {
  it("Handles CORS requests", async () => {
    await request
      ?.options("/")
      .expect(200)
      .then((res) => {
        expect(res.headers).toHaveProperty("access-control-allow-origin", "*")
        expect(res.headers).toHaveProperty("access-control-allow-methods", "*")
        expect(res.headers).toHaveProperty("access-control-allow-headers", "*")
      })
  }, testTimeout)
  
  it("Has a /test route", async () => {
    await request
      ?.get("/test")
      .expect(200)
      .then((res) => {
        expect(res.text).toEqual("Request received")
      })
  })
  
  it("Responds with 404 to unknown route requests", async () => {
    await request
      ?.get("/unknown")
      .expect(404)
      .then((res) => {
        expect(res.text).toEqual("Route not found")
      })
  }, testTimeout)
})

describe("/users/login", () => {
  beforeEach(async () => {
    await putDynamoUser()
  }, 60000)

  afterEach(async () => {
    await deleteDynamoUser()
  }, 60000)

  it("Succeeds with valid credentials", async () => {
    await request
      ?.post("/users/login")
      .send(validCredentials)
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual(expect.objectContaining({
          message: "Authentication successful",
          token: expect.any(String)
        }))
        expect(jwt.verify(res.body.token as string, tokenSecret))
          .toMatchObject(validUserEntity)
      })
  }, testTimeout)

  it("Fails when user doesn't exist", async () => {
    await request
      ?.post("/users/login")
      .send({
        ...validCredentials,
        email: "test2@test.com"
      })
      .expect(404)
      .then((res) => {
        expect(res.body).toHaveProperty("error", "Authentication failed. User not found.")
      })
  }, testTimeout)

  it("Fails when password doesn't match", async () => {
    await request
      ?.post("/users/login")
      .send({
        ...validCredentials,
        password: "invalidpassword"
      })
      .expect(401)
      .then((res) => {
        expect(res.body).toHaveProperty("error", "Authentication failed. Wrong password.")
      })
  }, testTimeout)
})

describe("/users/register", () => {
  beforeEach(async () => {
    await deleteDynamoUser()
  }, 60000)

  it("Succeeds with valid credentials", async () => {
    await request
      ?.post("/users/register")
      .send(validCredentials)
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual(expect.objectContaining({
          message: "Authentication successful",
          token: expect.any(String)
        }))
      })
  }, testTimeout)

  it("Fails with invalid account details", async () => {
    await Promise.all([
      request
        ?.post("/users/register")
        .send({})
        .expect(400)
        .then((res) => {
          expect(res.body).toHaveProperty("error", '"email" is required')
        }),
      request
        ?.post("/users/register")
        .send({ email: "test@test.com" })
        .expect(400)
        .then((res) => {
          expect(res.body).toHaveProperty("error", '"password" is required')
        }) ?? Promise.resolve(),
      request
        ?.post("/users/register")
        .send({ email: "test", password: "test" })
        .expect(400)
        .then((res) => {
          expect(res.body).toHaveProperty("error", '"test" is not a valid email address')
        })
    ])
  }, testTimeout)

  it("Fails if email is registered", async () => {
    await putDynamoUser()

    await request
      ?.post("/users/register")
      .send(validCredentials)
      .expect(400)
      .then((res) => {
        expect(res.body).toHaveProperty("error", `A user with email "${validCredentials.email}" is already registered`)
      })
  }, testTimeout)
})

describe("/user", () => {
  const formattedUserEntity = usersModel.formatUserEntity(validUserEntity)
  let validToken = ""

  beforeAll(() => {
    validToken = jwt.sign(formattedUserEntity, tokenSecret, {
      expiresIn: 60
    })
  })

  it("Succeeds if valid authorization token is sent", async () => {
    await putDynamoUser()

    await request
      ?.post("/user")
      .set("authorization", `Bearer ${validToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual(expect.objectContaining({
          user: usersModel.convertToPublicFormat(formattedUserEntity)
        }))
      })

    await deleteDynamoUser()
  }, testTimeout)

  it("Fails if user isn't in the database", async () => {
    await request
      ?.post("/user")
      .set("authorization", `Bearer ${validToken}`)
      .expect(401)
  }, testTimeout)

  it("Fails if user retrieval isn't possible", async () => {
    const usersMock = jest.spyOn(usersModel, "getById")
      .mockImplementation(async () => { throw new Error("Test") })

    await request
      ?.post("/user")
      .set("authorization", `Bearer ${validToken}`)
      .expect(500)

    expect(usersMock).toHaveBeenCalled()

    usersMock.mockRestore()
  }, testTimeout)

  it("Fails without authorization header", async () => {
    await request
      ?.post("/user")
      .expect(401)
  }, testTimeout)

  it("Fails with forged or expired token", async () => {
    await putDynamoUser()

    const forgedToken = jwt.sign(formattedUserEntity, "falseKey", {
      expiresIn: 60
    })

    const expiredToken = jwt.sign(formattedUserEntity, tokenSecret, {
      expiresIn: -60
    })

    await Promise.all([
      request
        ?.post("/user")
        .set("authorization", `Bearer ${forgedToken}`)
        .expect(401),
      request
        ?.post("/user")
        .set("authorization", `Bearer ${expiredToken}`)
        .expect(401)
    ])

    await deleteDynamoUser()
  }, testTimeout)
})
