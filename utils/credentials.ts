import { log } from 'console'
import fs from 'fs'
import path from 'path'

const rootPath = path.join(__dirname, '../')
const credentialsFolderPath = path.join(rootPath, 'credentials/')

export interface AdsPowerAccount {
  id: number | string
  password: string
  key: string
  address?: string | null
}

const fileExists = (filename: string): boolean => {
  try {
    fs.accessSync(path.join(credentialsFolderPath, filename))
    return true
  } catch (err) {
    log('Please create file:', filename)
    return false
  }
}

const filterAdspowerAccounts = (data: string[]): Record<string, AdsPowerAccount> => {
  const accounts: Record<string, AdsPowerAccount> = {}
  data.forEach((line) => {
    const [id, password, key] = line.split(';')
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(key)) accounts[id] = { id, password, key }
  })
  return accounts
}

const createFileIfNotExists = (filename: string, exampleData: string) => {
  if (!fileExists(filename)) {
    fs.writeFileSync(path.join(credentialsFolderPath, filename), exampleData)
  }
}

const readFile = <T>(filename: string, filterFunction: (data: string[]) => T, exampleData: string): T => {
  createFileIfNotExists(filename, exampleData)
  const fileContents = fs.readFileSync(path.join(credentialsFolderPath, filename), 'utf-8')
  const lines = [...new Set(fileContents.split('\n'))]
  return filterFunction(lines)
}

const readAccounts = <T>(filename: string, filterFunction: (data: string[]) => T, exampleData: string): T => {
  try {
    return readFile(filename, filterFunction, exampleData)
  } catch (err) {
    return {} as T
  }
}

// Readers
const exampleAdsPowerAccount = 'id;password;private_key'
export const readAdsPowerAccounts = () =>
  Object.values(
    readAccounts<Record<string, AdsPowerAccount>>('accounts.csv', filterAdspowerAccounts, exampleAdsPowerAccount)
  )
