import dotenv from 'dotenv'
dotenv.config()

import c from 'chalk'
import { log } from 'console'
import { AdsPowerAccount, readAdsPowerAccounts } from './utils/credentials'
import { wait } from './utils'
import { RabbyWallet } from './modules/rabbywallet'
import LocalJsonDatabase from './utils/store'
import { AdsPowerStatus, AdsProfile, getExistedAccounts } from './modules/adspower'

export const db = new LocalJsonDatabase('credentials/registered.json')

const rabbyTasks = async (account: any, credential: AdsPowerAccount) => {
  try {
    let newbie = false
    const profile = new AdsProfile(account)
    const exist = db.get(profile.user?.serial_number)
    if (exist) {
      await profile.close()
      return profile.l(
        c.green('skip already registered accounts, balance from db:', exist.balance, 'address:', exist.address)
      )
    }

    if (!profile.user) {
      newbie = true
      await profile.create(credential.id)
    }

    const browser = await profile.open()
    if (!browser) return

    const page = await browser.contexts()[0].newPage()

    try {
      const rabby = new RabbyWallet(page, credential)
      const result = await rabby.register()
      if (result) {
        db.set(profile.user.serial_number, {
          ...profile.user,
          credential: credential,
          ...result
        })
      }
    } catch (e) {
      log(e)
      log('try another extension...')
    }

    await page.close()
    await profile.close()

    return true
  } catch (e) {
    log(e)
    return false
  }
}

// Chunker
Object.defineProperty(Array.prototype, 'chunk', {
  value: function (n) {
    return Array.from(Array(Math.ceil(this.length / n)), (_, i) => this.slice(i * n, i * n + n))
  }
})

const main = async () => {
  await AdsPowerStatus()

  let credentials = readAdsPowerAccounts() as AdsPowerAccount[]
  log('Credentials for accounts finded:', credentials.length)

  const existed = await getExistedAccounts(50)
  log('Existed accounts finded:', existed.length)

  const existedUsers = credentials.filter((i) => !existed.some((e) => e.user_id === i.id || e.serial_number === i.id))
  log('Existed accounts with provided credentials:', existedUsers.length)

  const chunkSize = 3
  // @ts-ignore
  for (const chunk of existedUsers.chunk(chunkSize)) {
    await Promise.all(
      chunk.map(async (credential, i) => {
        await wait(1500 * i) // Minimal AdsPower timeout

        return rabbyTasks(
          {
            serial_number: credential.id
          },
          credential
        )
      })
    ).then((values) => log('chunk results: ', values))
    await wait(2500 * chunkSize)
  }

  console.log(c.green('All current works done!'))
}

try {
  main()
} catch (e) {
  log(c.red('Error in main function:'), e)
}
