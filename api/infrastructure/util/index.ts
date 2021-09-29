import * as child_process from "child_process"
import * as util from "util"
import * as fs from "fs"
import * as siteConfig from "../../../site/src/config.json"
import * as pulumi from "@pulumi/pulumi"
import * as upath from "upath"

const exec = util.promisify(child_process.exec)

const siteFolder = upath.join(__dirname, "..", "..", "..", "site")
const apiFolder = upath.join(__dirname, "..", "..")

export const packageLambda = async (): Promise<string> => {
  // Run package during preview step
  if(!process.env.SKIP_SLS_PACKAGE && pulumi.runtime.isDryRun()) {
    console.log("LAMBDA: Starting to package Lambda...")
    await execCommand(`cd ${apiFolder} && sls package`)
    console.log("LAMBDA: Lambda packaging complete")
  }

  return upath.join(apiFolder, ".serverless", "fullstack-api.zip")
}

export const uploadFrontend = async (bucketName: string): Promise<void> => {
  if(!process.env.SKIP_REACT_BUILD) {
    try {
      console.log("REACT: Starting to build React application")
      await execCommand(`cd ${siteFolder} && npm run build`)
      console.log("REACT: React application build complete")
    } catch(error) {
      if(!(error as Error)?.message?.includes("The system cannot find the path specified"))
        throw error
    }
  }

  console.log("REACT: Uploading build to S3")
  await execCommand(`aws s3 sync ${upath.join(siteFolder, "build")} s3://${bucketName} --acl public-read --delete`)
  console.log("REACT: Build upload complete")
}

export const updateFrontendConfig = (apiEndpoint: string): void => {
  fs.writeFileSync(upath.join(siteFolder, "src", "config.json"), JSON.stringify({
    ...siteConfig,
    domains: {
      ...siteConfig.domains,
      api: apiEndpoint.replace(/\/$/, "") // Remove trailing slash
    }
  }))
}

const execCommand = async (command: string): Promise<void> => {
  const { stdout, stderr } = await exec(command)
  console.log(stdout)
  if(stderr) {
    console.error(`CMD "${command}" ERROR:`, stderr)
    throw new Error(stderr)
  }
}
