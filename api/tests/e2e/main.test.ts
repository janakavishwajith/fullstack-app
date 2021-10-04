import * as shortid from "shortid"

before(() => {
  if(!Cypress.env("URL"))
    cy.task("pulumi:getUrl")
      .then(url => {
        Cypress.env("URL", url)
      })
})

beforeEach(() => {
  const distributionUrl = Cypress.env("URL")
  if(!distributionUrl)
    throw new Error("Distribution url undefined")

  // Navigate to front page
  cy.visit(distributionUrl)
})

const frontpageLoggedOutText = "A serverless full-stack application"
const frontpageLoggedInText = "Welcome to your serverless fullstack dashboard..."
const testUser = {
  email: `${shortid.generate()}.e2e.test@test.com`,
  password: "test"
}

describe("Login & Registration", () => {
  it("Register an user & log out successfully", () => {
    cy.get("#root")
      .contains(frontpageLoggedOutText)
      .should("exist")

    cy.get('a[href="/register"]')
      .click()

    // Fill the form & submit
    cy.get('#root input[type="text"]')
      .type(testUser.email)
    cy.get('#root input[type="password"]')
      .type(testUser.password)
    cy.get("#root .buttonPrimaryLarge")
      .should("have.value", "Register")
      .click()

    // Check for progress
    cy.contains("loading...")
      .should("exist")
    cy.contains(frontpageLoggedInText, {
      timeout: 20000 // Increase timeout for Lambda cold-start
    })
      .should("exist")
    cy.contains(testUser.email)
      .should("exist")

    // Log out
    cy.get("div.link")
      .contains("logout")
      .click()

    cy.get("#root")
      .contains(frontpageLoggedOutText)
      .should("exist")
  })

  it("Fails to register existing & invalid users", () => {
    cy.get("#root")
      .contains(frontpageLoggedOutText)
      .should("exist")

    cy.get('a[href="/register"]')
      .click()

    // Fill the form & submit
    cy.get('#root input[type="text"]')
      .type(testUser.email)
    cy.get('#root input[type="password"]')
      .type(testUser.password)
    cy.get("#root .buttonPrimaryLarge")
      .should("have.value", "Register")
      .click()

    cy.contains(`A user with email "${testUser.email}" is already registered`)
      .should("exist")

    // Re-fill the form w/ invalid email & submit
    cy.get('#root input[type="text"]')
      .clear()
      .type("test")
    cy.get('#root input[type="password"]')
      .clear()
      .type(testUser.password)
    cy.get("#root .buttonPrimaryLarge")
      .click()

    cy.contains("is not a valid email address")
      .should("exist")

    // Test empty fields
    cy.get('#root input[type="password"]')
      .clear()
    cy.get("#root .buttonPrimaryLarge")
      .click()
    cy.contains("password is required").should("exist")
    cy.get('#root input[type="text"]')
      .clear()
    cy.get("#root .buttonPrimaryLarge")
      .click()
    cy.contains("email is required").should("exist")
  })

  it("Logs in successfully", () => {
    cy.get("#root")
      .contains(frontpageLoggedOutText)
      .should("exist")

    cy.get('a[href="/login"]')
      .click()

    // Fill the form & submit
    cy.get('#root input[type="text"]')
      .type(testUser.email)
    cy.get('#root input[type="password"]')
      .type(testUser.password)
    cy.get("#root .buttonPrimaryLarge")
      .should("have.value", "Sign In")
      .click()

    // Check for progress
    cy.contains("loading...")
      .should("exist")
    cy.contains(frontpageLoggedInText)
      .should("exist")
    cy.contains(testUser.email)
      .should("exist")

    cy.getCookie("serverless")
    .then(cookie => {
      if(cookie)
        cy.setLocalStorage("cookie", cookie.value)
          .then(cy.saveLocalStorage)
    })
  })

  it("Login fails with invalid credentials", () => {
    cy.get("#root")
      .contains(frontpageLoggedOutText)
      .should("exist")

    cy.get('a[href="/login"]')
      .click()

    // Fill the form w/ invalid password & submit
    cy.get('#root input[type="text"]')
      .type(testUser.email)
    cy.get('#root input[type="password"]')
      .type("invalid.password!")
    cy.get("#root .buttonPrimaryLarge")
      .should("have.value", "Sign In")
      .click()

    cy.contains("Authentication failed. Wrong password.")
      .should("exist")

    // Re-fill the form w/ inexisting email & submit
    cy.get('#root input[type="text"]')
      .clear()
      .type("invalid.email@test.com")
    cy.get('#root input[type="password"]')
      .clear()
      .type(testUser.password)
    cy.get("#root .buttonPrimaryLarge")
      .click()

    cy.contains("Authentication failed. User not found.")
      .should("exist")

    // Re-fill the form w/ invalid email & submit
    cy.get('#root input[type="text"]')
      .clear()
      .type("test")
    cy.get('#root input[type="password"]')
      .clear()
      .type(testUser.password)
    cy.get("#root .buttonPrimaryLarge")
      .click()

    cy.contains("is not a valid email address")
      .should("exist")

    // Test empty fields
    cy.get('#root input[type="password"]')
      .clear()
    cy.get("#root .buttonPrimaryLarge")
      .click()
    cy.contains("password is required").should("exist")
    cy.get('#root input[type="text"]')
      .clear()
    cy.get("#root .buttonPrimaryLarge")
      .click()
    cy.contains("email is required").should("exist")
  })

  it("Persists session during reload", () => {
    // Check that we're not logged in before reload
    cy.get("#root")
      .contains(frontpageLoggedOutText)
      .should("exist")

    // Set cookie
    cy.restoreLocalStorage()
    cy.getLocalStorage("cookie")
      .then(cookie => {
        if(cookie)
          cy.setCookie("serverless", cookie)
      })
    // Reload & check log in status
    cy.reload()
    cy.reload() // Reload a second time for good measure
    cy.get("#root")
      .contains(frontpageLoggedInText)
      .should("exist")
  })
})
