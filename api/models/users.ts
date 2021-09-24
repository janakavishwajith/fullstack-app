/**
 * Model: Users
 */

import AWS = require('aws-sdk')
import { PutItemInput, QueryInput } from 'aws-sdk/clients/dynamodb'
import { generate } from 'shortid'
import { UserEntity, UserPublic } from '../types'
import { validateEmailAddress, hashPassword, parseDynamoDbAttributeMap } from '../utils'

/**
 * Register user
 * @param {string} user.email User email
 * @param {string} user.password User password
 */
export const register = async(user: UserEntity = {}): Promise<void> => {
  const { db, AWS_REGION } = process.env

  const dynamodb = new AWS.DynamoDB({
    region: AWS_REGION
  })

  // Validate
  if(!db)
    throw new Error("Unknown database")

  if (!user.email) {
    throw new Error(`"email" is required`)
  }
  if (!user.password) {
    throw new Error(`"password" is required`)
  }
  if (!validateEmailAddress(user.email)) {
    throw new Error(`"${user.email}" is not a valid email address`)
  }

  // Check if user is already registered
  const existingUser = await getByEmail(user.email)
  if (existingUser) {
    throw new Error(`A user with email "${user.email}" is already registered`)
  }

  user.password = hashPassword(user.password)

  // Save
  const params: PutItemInput = {
    TableName: db,
    Item: {
      hk: { S: user.email },
      sk: { S: 'user' },
      sk2: { S: generate() },
      createdAt: { N: Date.now().toString() },
      updatedAt: { N: Date.now().toString() },
      password: { S: user.password },
    }
  }

  await dynamodb.putItem(params).promise()
}

/**
 * Get user by email address
 * @param {string} email
 */

export const getByEmail = async(email: string): Promise<UserEntity | null> => {
  const { db, AWS_REGION } = process.env

  const dynamodb = new AWS.DynamoDB({
    region: AWS_REGION
  })

  // Validate
  if(!db)
    throw new Error("Unknown database")

  if (!email) {
    throw new Error(`"email" is required`)
  }

  if (!validateEmailAddress(email)) {
    throw new Error(`"${email}" is not a valid email address`)
  }

  // Query
  const params: QueryInput = {
    TableName: db,
    KeyConditionExpression: 'hk = :hk',
    ExpressionAttributeValues: { ':hk': { S: email } }
  }

  const result = await dynamodb.query(params).promise()
  const attributes = result.Items && result.Items[0] ? result.Items[0] : null
  if(!attributes)
    return null

  const user = parseDynamoDbAttributeMap(attributes)
  

  user.id = user.sk2
  user.email = user.hk

  return user
}

/**
 * Get user by id
 * @param {string} id
 */

export const getById = async (id: string): Promise<UserEntity | null> => {
  const { db, AWS_REGION, dbIndex1 } = process.env

  const dynamodb = new AWS.DynamoDB({
    region: AWS_REGION
  })

  // Validate
  if(!db)
    throw new Error("Unknown database")
  
  if (!id) {
    throw new Error(`"id" is required`)
  }

  // Query
  const params: QueryInput = {
    TableName: db,
    IndexName: dbIndex1,
    KeyConditionExpression: 'sk2 = :sk2 and sk = :sk',
    ExpressionAttributeValues: { ':sk2': { S: id }, ':sk': { S: 'user' } }
  }

  const result = await dynamodb.query(params).promise()
  const attributes = result.Items && result.Items[0] ? result.Items[0] : null
  if(!attributes)
    return null

  const user = parseDynamoDbAttributeMap(attributes)
  
  user.id = user.sk2
  user.email = user.hk

  return user
}

/**
 * Convert user record to public format
 * This hides the keys used for the dynamodb's single table design and returns human-readable properties.
 * @param {*} user 
 */
export const convertToPublicFormat = (user: UserEntity): UserPublic => {
  user.email = user.hk
  user.id = user.sk2
  
  if (user.hk) delete user.hk
  if (user.sk) delete user.sk
  if (user.sk2) delete user.sk2
  if (user.password) delete user.password

  return user
}
