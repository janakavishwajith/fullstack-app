/**
 * Model: Users
 */

import AWS = require('aws-sdk')
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { generate } from 'shortid'
import { UserEntity, UserPublic } from '../types'
import { validateEmailAddress, hashPassword } from '../utils'

/**
 * Register user
 * @param {string} user.email User email
 * @param {string} user.password User password
 */
export const register = async(user: UserEntity = {}): Promise<void> => {
  const { db, AWS_REGION } = process.env

  const dynamodb = new AWS.DynamoDB.DocumentClient({
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
  const params: DocumentClient.PutItemInput = {
    TableName: db,
    Item: {
      hk: user.email,
      sk: 'user',
      sk2: generate(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      password: user.password,
    }
  }

  await dynamodb.put(params).promise()
}

/**
 * Get user by email address
 * @param {string} email
 */

export const getByEmail = async(email: string): Promise<UserEntity | null> => {
  const { db, AWS_REGION } = process.env

  const dynamodb = new AWS.DynamoDB.DocumentClient({
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
  const params: DocumentClient.QueryInput = {
    TableName: db,
    KeyConditionExpression: 'hk = :hk',
    ExpressionAttributeValues: { ':hk': email }
  }

  const result = await dynamodb.query(params).promise()
  const user = result.Items && result.Items[0] ? result.Items[0] : null
  if(!user)
    return null

  return formatUserEntity(user)
}

/**
 * Get user by id
 * @param {string} id
 */

export const getById = async (id: string): Promise<UserEntity | null> => {
  const { db, AWS_REGION, dbIndex1 } = process.env

  const dynamodb = new AWS.DynamoDB.DocumentClient({
    region: AWS_REGION
  })

  // Validate
  if(!db)
    throw new Error("Unknown database")
  
  if (!id) {
    throw new Error(`"id" is required`)
  }

  // Query
  const params: DocumentClient.QueryInput = {
    TableName: db,
    IndexName: dbIndex1,
    KeyConditionExpression: 'sk2 = :sk2 and sk = :sk',
    ExpressionAttributeValues: { ':sk2': id, ':sk': 'user' }
  }

  const result = await dynamodb.query(params).promise()
  const user = result.Items && result.Items[0] ? result.Items[0] : null
  if(!user)
    return null

  return formatUserEntity(user)
}

/**
 * Add id and email fields to UserEntity object
 * @param {UserEntity} user
 * @returns {UserEntity} Formatted user
 */
export const formatUserEntity = (user: UserEntity): UserEntity => ({
  ...user,
  id: user.sk2,
  email: user.hk
})

/**
 * Convert user record to public format
 * This hides the keys used for the dynamodb's single table design and returns human-readable properties.
 * @param {UserEntity} user
 * @returns {UserPublic}
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
