import AWS = require("aws-sdk")
import AWSMock = require("aws-sdk-mock")

import { UserEntity } from "../types"
import * as users from "./users"
import * as utils from '../utils'
import { generate } from "shortid"

const testEnv = { ...process.env }

const testUserEntity = {
  hk: "test@test.com",
  sk: "user",
  sk2: generate(),
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
  password: "testpassword"
}

describe(".register()", () => {
  const { register } = users

  beforeEach(() => {
    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb(null, null))
  })

  afterEach(() => {
    process.env = { ...testEnv }
    AWSMock.restore('DynamoDB.DocumentClient', 'put')
  })

  const validTestUser: UserEntity = {
    email: "test@gmail.com",
    password: "test"
  }

  const validateEmailAddressSpy = jest.spyOn(utils, 'validateEmailAddress')
  const hashPasswordSpy = jest.spyOn(utils, 'hashPassword')

  const getByEmailSpy = jest.spyOn(users, "getByEmail")

  it("Registers a valid user", async () => {
    process.env.db = 'test'

    validateEmailAddressSpy.mockImplementationOnce(() => true)
    hashPasswordSpy.mockImplementationOnce((pw) => pw)
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(null))

    await register(validTestUser)

    expect(validateEmailAddressSpy).toHaveBeenCalledWith(validTestUser.email)
    expect(getByEmailSpy).toHaveBeenCalledWith(validTestUser.email)
    expect(hashPasswordSpy).toHaveBeenCalledWith(validTestUser.password)
  })

  it("Throws upon missing database env variable", async () => {
    await expect(async () => await register())
      .rejects
      .toThrowError("Unknown database")
  })

  it("Throws upon missing/invalid email or password", async () => {
    process.env.db = 'test'
    
    await expect(async () => await register())
      .rejects
      .toThrowError('"email" is required')

    await expect(async () => await register({ email: "test" }))
      .rejects
      .toThrowError('"password" is required')

    validateEmailAddressSpy.mockImplementationOnce(() => false)
    await expect(async () => await register(validTestUser))
      .rejects
      .toThrowError(`"${validTestUser.email}" is not a valid email address`)
  })

  it("Throws if user already exists", async () => {
    process.env.db = 'test'
    validateEmailAddressSpy.mockImplementationOnce(() => true)
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(validTestUser))

    await expect(async () => register(validTestUser))
      .rejects
      .toThrowError(`A user with email "${validTestUser.email}" is already registered`)
  })
})

describe(".getByEmail()", () => {
  const { getByEmail } = users

  afterEach(() => {
    process.env = { ...testEnv }
  })

  const validateEmailAddressSpy = jest.spyOn(utils, 'validateEmailAddress')

  it("Returns null if user was not found", async () => {
    process.env.db = 'test'

    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {}))
    validateEmailAddressSpy.mockImplementationOnce(() => true)

    const result = await getByEmail("test")
    expect(result).toBeNull()

    AWSMock.restore('DynamoDB.DocumentClient', 'query')
  })

  it("Returns user entity when found", async () => {
    process.env.db = 'test'

    const dynamoResponse = {
      Items: [
        testUserEntity
      ]
    }

    const expectedResult = {
      ...testUserEntity,
      id: testUserEntity.sk2,
      email: testUserEntity.hk
    }

    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, dynamoResponse))

    const result = await getByEmail(testUserEntity.hk)
    expect(result).toEqual(expectedResult)

    AWSMock.restore('DynamoDB.DocumentClient', 'query')
  })

  it("Throws upon missing database env variable", async () => {
    await expect(async () => await getByEmail(""))
      .rejects
      .toThrowError("Unknown database")
  })

  it("Throws upon missing or invalid email", async () => {
    process.env.db = 'test'
    
    await expect(async () => await getByEmail(""))
      .rejects
      .toThrowError('"email" is required')

    validateEmailAddressSpy.mockImplementationOnce(() => false)
    await expect(async () => await getByEmail("test"))
      .rejects
      .toThrowError(`"test" is not a valid email address`)
  })
})

describe(".getById()", () => {
  const { getById } = users

  afterEach(() => {
    process.env = { ...testEnv }
  })

  const validateEmailAddressSpy = jest.spyOn(utils, 'validateEmailAddress')

  it("Returns null if user was not found", async () => {
    process.env.db = 'test'

    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, {}))
    validateEmailAddressSpy.mockImplementationOnce(() => true)

    const result = await getById("test")
    expect(result).toBeNull()

    AWSMock.restore('DynamoDB.DocumentClient', 'query')
  })

  it("Returns user entity when found", async () => {
    process.env.db = 'test'

    const dynamoResponse = {
      Items: [
        testUserEntity
      ]
    }

    const expectedResult = {
      ...testUserEntity,
      id: testUserEntity.sk2,
      email: testUserEntity.hk
    }

    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(null, dynamoResponse))

    const result = await getById(testUserEntity.hk)
    expect(result).toEqual(expectedResult)

    AWSMock.restore('DynamoDB.DocumentClient', 'query')
  })

  it("Throws upon missing database env variable", async () => {
    await expect(async () => await getById(""))
      .rejects
      .toThrowError("Unknown database")
  })

  it("Throws upon missing id", async () => {
    process.env.db = 'test'
    
    await expect(async () => await getById(""))
      .rejects
      .toThrowError(`"id" is required`)
  })
})

describe(".convertToPublicFormat()", () => {
  const { convertToPublicFormat } = users

  it("Converts user entity to displayable format", () => {
    const testObject = { ...testUserEntity }
    const { hk, sk2, createdAt, updatedAt } = testUserEntity

    const expectedResult = {
      email: hk,
      id: sk2,
      createdAt,
      updatedAt
    }

    expect(convertToPublicFormat(testObject)).toEqual(expectedResult)
  })

  it("Ignores keys if they don't exist", () => {
    expect(convertToPublicFormat({})).toEqual({})
  })
})
