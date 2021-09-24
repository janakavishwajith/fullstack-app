/**
 * Controllers: Users
 */

import { NextFunction, Request, Response } from 'express'
import * as jwt from 'jsonwebtoken'
import { users } from '../models'
import { UserEntity } from '../types'
import { comparePassword } from '../utils'

/**
 * Save
 * @param {*} req 
 * @param {*} res 
 * @param {*} next
 */
export const register = async (req: Request, res: Response): Promise<void | Response> => {
  const { tokenSecret } = process.env

  try {
    await users.register(req.body)
  } catch (error) {
    return res.status(400)
      .json({ error: error.message })
  }

  try {
    const user = await users.getByEmail(req.body.email)

    if(!user)
      throw new Error("User not found")

    if(!tokenSecret)
      throw new Error("Token secret is undefined")

    const token = jwt.sign(user as Record<string, unknown>, tokenSecret, {
      expiresIn: 604800 // 1 week
    })
  
    res.json({ message: 'Authentication successful', token })
  } catch (error) {
    console.error(error)
    return res.status(500)
      .json({ error: error.message })
  }
}

/**
 * Sign a user in
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const { tokenSecret } = process.env

  let user: UserEntity | null = null
  try {
    if(!tokenSecret)
      throw new Error("Token secret is undefined")

    user = await users.getByEmail(req.body.email) 
  }
  catch (error) { return next(error) }

  if (!user) {
    return res.status(404)
      .send({ error: 'Authentication failed. User not found.' })
  }

  const isCorrect = comparePassword(req.body.password, user.password as string)
  if (!isCorrect) {
    return res.status(401)
      .send({ error: 'Authentication failed. Wrong password.' })
  }

  const token = jwt.sign(user, tokenSecret, {
    expiresIn: 604800 // 1 week
  })

  res.json({ message: 'Authentication successful', token })
}

/**
 * Get a user
 * @param {*} req 
 * @param {*} res 
 * @param {*} _next 
 */
export const get = async (req: Request, res: Response): Promise<void> => {
  const user = users.convertToPublicFormat(req.user as UserEntity)
  res.json({ user })
}
