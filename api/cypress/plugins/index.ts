/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************
// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)
/**
 * @type {Cypress.PluginConfig}
 */
import * as automation from "../../infrastructure/automation"
import * as shortid from "shortid"

const stackName = `test-e2e-${shortid.generate()}`

const deploy = async(): Promise<null> => {
  console.log(`Starting stack "${stackName}" deploy`)
  await automation.deploy(stackName)
  console.log(`Stack "${stackName}" deployed`)

  return null
}

const destroy = async (): Promise<null> => {
  // Destroy Pulumi stack
  console.log(`Starting stack "${stackName}" destroy`)
  await automation.destroy(stackName, true)
  console.log(`Stack "${stackName}" destroyed`)

  return null
}

export default (
  on: Cypress.PluginEvents,
  _config: Cypress.PluginConfigOptions
): void => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  on("task", {
    async "pulumi:getUrl"(): Promise<string | undefined> {
      const outputs = await automation.getOutputs(stackName)
      return outputs?.frontendUrl?.value
    }
  })

  on("before:run", async (details) => { 
    if(!details?.config?.env?.SKIP_PULUMI)
      await deploy()
  })
  on("after:run", async () => { await destroy() })
}
