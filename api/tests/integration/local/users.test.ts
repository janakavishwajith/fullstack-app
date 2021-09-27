import * as request from "supertest"
import AWS = require("aws-sdk")
import AWSMock = require("aws-sdk-mock")
import { generate } from "shortid"
import * as bcrypt from "bcryptjs"
import * as jwt from "jsonwebtoken"
import { users as usersModel } from "../../../models"

const testEnv = { ...process.env }
const tokenSecret = "test"
process.env.tokenSecret = tokenSecret // Set secret before importing app for passport config

import { app } from "../../../app"

beforeEach(() => {
  process.env.db = "test"
  process.env.tokenSecret = tokenSecret

  AWSMock.setSDKInstance(AWS)
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

describe("/users/login", () => {
  it("Succeeds with valid credentials", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    await request(app)
      .post("/users/login")
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
  })

  it("Fails when user doesn't exist", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: []
    }))

    await request(app)
      .post("/users/login")
      .send(validCredentials)
      .expect(404)
      .then((res) => {
        expect(res.body).toHaveProperty("error", "Authentication failed. User not found.")
      })
  })

  it("Fails when password doesn't match", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    await request(app)
      .post("/users/login")
      .send({
        ...validCredentials,
        password: "invalidpassword"
      })
      .expect(401)
      .then((res) => {
        expect(res.body).toHaveProperty("error", "Authentication failed. Wrong password.")
      })
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

    await request(app)
      .post("/users/register")
      .send(validCredentials)
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual(expect.objectContaining({
          message: "Authentication successful",
          token: expect.any(String)
        }))
      })
  })

  it("Fails with invalid account details", async () => {
    Promise.all([
      request(app)
        .post("/users/register")
        .send({})
        .expect(400)
        .then((res) => {
          expect(res.body).toHaveProperty("error", '"email" is required')
        }),
      request(app)
        .post("/users/register")
        .send({ email: "test@test.com" })
        .expect(400)
        .then((res) => {
          expect(res.body).toHaveProperty("error", '"password" is required')
        }),
      request(app)
        .post("/users/register")
        .send({ email: "test", password: "test" })
        .expect(400)
        .then((res) => {
          expect(res.body).toHaveProperty("error", '"test" is not a valid email address')
        })
    ])
  })

  it("Fails if email is registered", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    await request(app)
      .post("/users/register")
      .send(validCredentials)
      .expect(400)
      .then((res) => {
        expect(res.body).toHaveProperty("error", `A user with email "${validCredentials.email}" is already registered`)
      })
  })
})

describe("/user", () => {
  const formattedUserEntity = usersModel.formatUserEntity(validUserEntity)
  const validToken = jwt.sign(formattedUserEntity, tokenSecret, {
    expiresIn: 60
  })

  it("Succeeds if valid authorization token is sent", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: [ validUserEntity ]
    }))

    await request(app)
      .post("/user")
      .set("authorization", `Bearer ${validToken}`)
      .then((res) => {
        expect(res.body).toEqual(expect.objectContaining({
          user: usersModel.convertToPublicFormat(formattedUserEntity)
        }))
      })
  })

  it("Fails if user isn't in the database", async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {
      Items: []
    }))

    await request(app)
      .post("/user")
      .set("authorization", `Bearer ${validToken}`)
      .expect(401)
  })

  it("Fails if user retrieval isn't possible", async () => {
    jest.spyOn(usersModel, "getById")
      .mockImplementationOnce(() => { throw new Error("Test") })

    await request(app)
      .post("/user")
      .set("authorization", `Bearer ${validToken}`)
      .expect(500)
  })

  it("Fails without authorization header", async () => {
    await request(app)
      .post("/user")
      .expect(401)
  })

  it("Fails with forged or expired token", async () => {
    const forgedToken = jwt.sign(formattedUserEntity, "falseKey", {
      expiresIn: 60
    })

    const expiredToken = jwt.sign(formattedUserEntity, tokenSecret, {
      expiresIn: -60
    })

    await Promise.all([
      request(app)
        .post("/user")
        .set("authorization", `Bearer ${forgedToken}`)
        .expect(401),
      request(app)
        .post("/user")
        .set("authorization", `Bearer ${expiredToken}`)
        .expect(401)
    ])
  })
})
