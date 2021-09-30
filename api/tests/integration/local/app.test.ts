import * as supertest from "supertest"
import { setupApp } from "../../../app"

const testEnv = { ...process.env }
const tokenSecret = "test"

let request = supertest(setupApp())

beforeEach(() => {
  jest.resetModules()
  process.env.db = "test"
  process.env.tokenSecret = tokenSecret

  // Reset app instance to inject environment
  request = supertest(setupApp())
})

afterEach(() => {
  process.env = { ...testEnv }
})

it("Handles CORS requests", async () => {
  await request
    .options("/")
    .expect(200)
    .then((res) => {
      expect(res.headers).toHaveProperty("access-control-allow-origin", "*")
      expect(res.headers).toHaveProperty("access-control-allow-methods", "*")
      expect(res.headers).toHaveProperty("access-control-allow-headers", "*")
    })
})

it("Has a /test route", async () => {
  await request
    .get("/test")
    .expect(200)
    .then((res) => {
      expect(res.text).toEqual("Request received")
    })
})

it("Responds with 404 to unknown route requests", async () => {
  await request
    .get("/unknown")
    .expect(404)
    .then((res) => {
      expect(res.text).toEqual("Route not found")
    })
})
