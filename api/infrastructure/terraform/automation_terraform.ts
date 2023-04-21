import { execCommand, execCommandOutput, packageLambda } from "../util"
import * as upath from "upath"
import { TFState } from "./TFState"
import {readFile} from 'fs/promises'


const terraformFolder = upath.join(__dirname, "plan")
const terffaformOutputFile = upath.join(__dirname, "plan", "terraform.tfstate")
let package_path = ""


export const deploy = async (): Promise<any> => {
  console.log("Deploying terraform plan...")
  
  package_path = await packageLambda()

  console.log(`package path is ${package_path}`)
      
  const terraInit = await execCommand(`cd ${terraformFolder} && terraform init`)
  const outputIs = await execCommandOutput(`cd ${terraformFolder} && terraform apply -auto-approve -var 'lambda_location=${package_path}'`)

  console.log("Output of the apply - ", outputIs)

  const outputObj = await processTFState()
  return outputObj
}

export const destroy = async (): Promise<any> => {
  console.log("Destroying terraform plan...")

  const outputIs = execCommandOutput(`cd ${terraformFolder} && terraform destroy -auto-approve -var 'lambda_location=${package_path}'`)

  return outputIs
}


const processTFState = async (): Promise<any> => {
 
  const tfStatus = await readFile(terffaformOutputFile)
  const tfStatusJson = JSON.parse(tfStatus.toString())

  const output = tfStatusJson.outputs
  
  console.log("Output - ", output)

  return output
}