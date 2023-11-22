import fs from 'fs'
import _ from 'lodash'

class LocalJsonDatabase {
  private filename: string
  private data: { [key: string]: any }

  constructor(filename: string) {
    this.filename = filename
    this.data = {}

    if (fs.existsSync(filename)) {
      const fileData = fs.readFileSync(filename, 'utf-8')
      try {
        this.data = JSON.parse(fileData)
      } catch (error) {
        console.error(`Saving JSON error ${filename}:`, error)
      }
    }
  }

  public get(key: string): any {
    return key ? this.data[key] : null
  }

  public delete(key: string): any {
    delete this.data[key]
    return this.saveDataToFile()
  }

  public set(key: string, value: any): boolean {
    const cleared = _.cloneDeep(value)
    delete cleared.signer

    if (cleared.x) {
      delete cleared.x.start
      delete cleared.x.client
      delete cleared.x.isSolving
      delete cleared.x.attempts
      delete cleared.x.endpoint
    }

    this.data[key] = cleared
    return this.saveDataToFile()
  }

  public searchByField(field: string, value: any): any[] {
    const results = []
    for (const key in this.data) {
      if (this.data.hasOwnProperty(key)) {
        if (this.data[key][field] === value) {
          results.push(this.data[key])
        }
      }
    }
    return results
  }

  public all(): any {
    return Object.values(this.data)
  }

  public find(field: string, value: any): any {
    return this.searchByField(field, value)[0]
  }

  private saveDataToFile(): boolean {
    const jsonData = JSON.stringify(this.data, null, 2)
    const tempFilename = `${this.filename}.temp`

    try {
      fs.writeFileSync(tempFilename, jsonData, 'utf-8')
      fs.renameSync(tempFilename, this.filename)
      return true
    } catch (error) {
      console.error('Error on save:', error)
      return false
    }
  }
}

export default LocalJsonDatabase
