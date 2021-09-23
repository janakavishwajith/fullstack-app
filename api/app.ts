import * as express from "express"
import * as passport from "passport"
import * as serverless from "serverless-http"
import { users } from "./controllers"
import configurePassport from "./config/passport"
import { NextFunction, Request, RequestHandler, Response } from "express"

const app = express()

/**
 * Configure Passport
 */

try { configurePassport(passport) }
catch (error) { console.log(error) }

/**
 * Configure Express.js Middleware
 */

// Enable CORS
app.use(function (req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('x-powered-by', 'serverless-express')
  next()
})

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize())
app.use(passport.session())

// Enable JSON use
app.use(express.json())

// Since Express doesn't support error handling of promises out of the box,
// this handler enables that
const asyncHandler = (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  return Promise
    .resolve(fn(req, res, next))
    .catch(next);
};

/**
 * Routes - Public
 */

app.options(`*`, (req, res) => {
  res.status(200).send()
})

app.post(`/users/register`, asyncHandler(users.register))

app.post(`/users/login`, asyncHandler(users.login))

app.get(`/test/`, (req: Request, res: Response) => {
  res.status(200).send('Request received')
})

/**
 * Routes - Protected
 */

app.post(`/user`, passport.authenticate('jwt', { session: false }), asyncHandler(users.get))

/**
 * Routes - Catch-All
 */

app.get(`/*`, (req: Request, res: Response) => {
  res.status(404).send('Route not found')
})

/**
 * Error Handler
 */
app.use(function (err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  res.status(500).json({ error: `Internal Serverless Error - "${err.message}"` })
})

export const handler = serverless(app)
