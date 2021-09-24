import * as utils from "./index"
import * as bcrypt from "bcryptjs"

const { validateEmailAddress, hashPassword, comparePassword } = utils

describe(".validateEmailAddress()", () => {
  it("Returns true on valid emails", () => {
    expect(validateEmailAddress("test@test.com")).toEqual(true)
    expect(validateEmailAddress("john.doe@eduskunta.fi")).toEqual(true)
  })

  it("Returns false on invalid emails", () => {
    expect(validateEmailAddress("test")).toEqual(false)
    expect(validateEmailAddress("a@a.a")).toEqual(false)
    expect(validateEmailAddress("test.com")).toEqual(false)
    expect(validateEmailAddress("test@test")).toEqual(false)
  })
})

describe(".hashPassword()", () => {
  it("Hashes a password", () => {
    const password = "test"
    const salt = bcrypt.genSaltSync(10)
    jest.spyOn(bcrypt, 'genSaltSync')
      .mockImplementationOnce(() => salt)

    expect(hashPassword(password)).toEqual(bcrypt.hashSync(password, salt))
  })
})

describe(".comparePassword()", () => {
  it("Returns true when passwords match", () => {
    const password = "test"
    const passwordHash = bcrypt.hashSync(password, 10)
    expect(comparePassword(password, passwordHash)).toEqual(true)
  })

  it("Returns false when passwords do not match", () => {
    const passwordHash = bcrypt.hashSync("test", 10)
    expect(comparePassword("test2", passwordHash)).toEqual(false)
  })
})
