/**
 * Utils 
 */

import { AttributeMap } from "aws-sdk/clients/dynamodb"
import * as bcrypt from "bcryptjs"

/**
 * Validate email address
 */
export const validateEmailAddress = (email: string): boolean => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(String(email).toLowerCase())
}

/**
 * Hash password
 * @param {*} user 
 */
export const hashPassword = (password: string): string => {
  const salt = bcrypt.genSaltSync(10)
  return bcrypt.hashSync(password, salt)
}

/**
 * Compare password
 */
export const comparePassword = (candidatePassword: string, trustedPassword: string): boolean => {
  return bcrypt.compareSync(candidatePassword, trustedPassword)
}

export const parseDynamoDbAttributeMap = (output: AttributeMap): Record<string, string> => {
  const keys = Object.keys(output)
  const result: Record<string, string> = {}
  keys.forEach((key) => {
    const attribute = output[key]
    if(attribute.S)
      result[key] = attribute.S
    else if(attribute.N)
      result[key] = attribute.N
  })

  return result
}
