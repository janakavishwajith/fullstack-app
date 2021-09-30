import * as userControllers from "../../../controllers/users"
import { users as userModels } from "../../../models"
import { getMockReq, getMockRes } from "@jest-mock/express"
import { generate } from "shortid"
import * as utils from "../../../utils"

const testEnv = { ...process.env }

const { res, next, mockClear } = getMockRes()

const registerModelSpy = jest.spyOn(userModels, 'register')
const getByEmailSpy = jest.spyOn(userModels, 'getByEmail')
const comparePasswordSpy = jest.spyOn(utils, 'comparePassword')

beforeEach(() => {
  jest.resetModules()
  mockClear()
})

afterEach(() => {
  process.env = { ...testEnv }
})

const savedUserEntity = {
  hk: "test@test.com",
  sk: "user",
  sk2: generate(),
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
  password: "test"
}

const savedUser = {
  ...savedUserEntity,
  email: savedUserEntity.hk,
  id: savedUserEntity.sk2
}

describe("Registration controller", () => {
  const req = getMockReq({
    body: {
      email: savedUser.email,
      password: savedUser.password
    }
  })

  it("Returns status 200 & JWT token on successful registration", async () => {
    process.env.tokenSecret = "testSecret"

    registerModelSpy.mockImplementationOnce(() => Promise.resolve())
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(savedUser))

    await userControllers.register(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication successful'
      })
    )
  })

  it("Returns status 400 when user already exists", async () => {
    process.env.tokenSecret = "testSecret"
    const errorMessage = `A user with email "${savedUser.email}" is already registered`
    registerModelSpy.mockImplementationOnce(() => Promise.reject(new Error(errorMessage)))

    await userControllers.register(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: errorMessage
      })
    )
  })

  it("Returns status 500 when token secret is missing or created user couldn't be found", async () => {
    registerModelSpy.mockImplementation(() => Promise.resolve())
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(null))

    await userControllers.register(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "User not found"
      })
    )

    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(savedUser))
    await userControllers.register(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Token secret is undefined"
      })
    )

    registerModelSpy.mockClear()
  })
})

describe("Login controller", () => {
  const req = getMockReq({
    body: {
      email: savedUser.email,
      password: savedUser.password
    }
  })
  
  it("Returns 200 on successful login", async () => {
    process.env.tokenSecret = "testSecret"
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(savedUser))
    comparePasswordSpy.mockImplementationOnce(() => true)

    await userControllers.login(req, res, next)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication successful'
      })
    )
  })

  it("Returns 404 upon user not found", async () => {
    process.env.tokenSecret = "testSecret"
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(null))

    await userControllers.login(req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Authentication failed. User not found.'
      })
    )
  })

  it("Returns 401 upon invalid password", async () => {
    process.env.tokenSecret = "testSecret"
    getByEmailSpy.mockImplementationOnce(() => Promise.resolve(savedUser))
    comparePasswordSpy.mockImplementationOnce(() => false)

    await userControllers.login(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Authentication failed. Wrong password.'
      })
    )
  })

  it("Calls next with Error upon missing token or failing to get user", async () => {
    await userControllers.login(req, res, next)
    expect(next).toHaveBeenCalledWith(new Error("Token secret is undefined"))

    process.env.tokenSecret = "testSecret"
    const testError = new Error("Test")
    getByEmailSpy.mockImplementationOnce(() => Promise.reject(testError))

    await userControllers.login(req, res, next)
    expect(next).toHaveBeenCalledWith(testError)
  })
})

describe("Get User Controller", () => {
  const req = getMockReq({
    user: {
      ...savedUser
    }
  })

  it("Returns authenticated user", async () => {
    jest.spyOn(userModels, 'convertToPublicFormat').mockImplementationOnce(user => user)

    await userControllers.get(req, res)

    expect(res.json).toHaveBeenCalledWith({ user: { ...savedUser }})
  })
})
