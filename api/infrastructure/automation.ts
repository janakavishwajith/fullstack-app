import { LocalProgramArgs, LocalWorkspace, OutputMap, Stack } from "@pulumi/pulumi/automation"
import { execCommand } from "./util"

const defaultArgs: LocalProgramArgs = {
  stackName: "dev",
  workDir: __dirname
}

const getStack = async (
  stackName: string = defaultArgs.stackName
): Promise<Stack> => {
  const args = {
    ...defaultArgs,
    stackName
  }

  return await LocalWorkspace.createOrSelectStack(args)
}

export const deploy = async (
  stackName: string = defaultArgs.stackName,
  region = "eu-central-1"
): Promise<OutputMap> => {
  const stack = await getStack(stackName)
  stack.setConfig("aws:region", { value: region })

  const up = await stack.up({ onOutput: console.log })

  return up.outputs
}

export const destroy = async (
  stackName?: string,
  rm = false
): Promise<void> => {
  const stack = await getStack(stackName)

  await stack.destroy()
  if(rm)
    await remove(stackName)
}

export const remove = async (
  stackName?: string
): Promise<void> => {
  await execCommand(`pulumi stack rm ${stackName} --yes`)
}

export const getOutputs = async(
  stackName: string = defaultArgs.stackName
): Promise<OutputMap> => {
  const stack = await getStack(stackName)

  return await stack.outputs()
}

export const getRegion = async (stackName?: string): Promise<string> => {
  const stack = await getStack(stackName)
  return (await stack.getConfig("aws:region")).value
}
