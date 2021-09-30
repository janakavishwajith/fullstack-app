import * as request from "supertest"

const testEnv = { ...process.env }
const tokenSecret = "test"
process.env.tokenSecret = tokenSecret // Set secret before importing app for passport config

import { app } from "../../../app"

beforeEach(() => {
  jest.resetModules()
  process.env.db = "test"
  process.env.tokenSecret = tokenSecret
})

afterEach(() => {
  process.env = { ...testEnv }
})

it("Handles CORS requests", async () => {
  await request(app)
    .options("/")
    .expect(200)
    .then((res) => {
      expect(res.headers).toHaveProperty("access-control-allow-origin", "*")
      expect(res.headers).toHaveProperty("access-control-allow-methods", "*")
      expect(res.headers).toHaveProperty("access-control-allow-headers", "*")
    })
})

it("Has a /test route", async () => {
  await request(app)
    .get("/test")
    .expect(200)
    .then((res) => {
      expect(res.text).toEqual("Request received")
    })
})

it("Responds with 404 to unknown route requests", async () => {
  await request(app)
    .get("/unknown")
    .expect(404)
    .then((res) => {
      expect(res.text).toEqual("Route not found")
    })
})
