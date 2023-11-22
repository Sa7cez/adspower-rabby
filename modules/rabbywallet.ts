import c from 'chalk'
import { Page } from 'playwright'
import { Wallet } from 'ethers'
import { hex } from '../utils'
import { log } from 'console'

const EXTENSION_ID = 'jfohnbkpbfipklolfohbpgbkcoadhkfd'

export class RabbyWallet {
  id: number
  password: string
  key: string
  address: string
  balance: string
  page: Page

  constructor(page, credentials) {
    this.page = page
    this.page.setDefaultTimeout(5000)

    this.id = credentials.id
    this.password = credentials.password
    this.key = credentials.key

    this.address = new Wallet(this.key).address
  }

  l(...args): false {
    return console.log.apply(console, [c.cyan(`Profile ${this.id}:`), hex(this.address), ...args]) as false
  }

  error = (...args: any[]) => this.l(c.red(...args)) as false
  success = (...args: any[]) => this.l(c.green(...args)) as true
  skip = (...args: any[]) => this.l(c.gray(...args))
  warning = (...args: any[]) => this.l(c.yellow(...args))

  // First enter to Rabby wallet
  welcome = async () => {
    try {
      await this.page.getByText('Next').click()
      await this.page.getByText('Get started').click()

      this.success('successful skip welcome onboarding')
    } catch (e) {
      this.skip('welcome onboarding skip')
    }
  }

  // Unlock Wallet
  unlock = async (password = this.password) => {
    try {
      const passwordField = await this.page.getByPlaceholder('Password')
      await passwordField.clear()
      await passwordField.fill(password, { noWaitAfter: false })

      await this.page.keyboard.press('Enter')
      await this.page.waitForTimeout(100)

      if (await this.page.getByRole('alert').isVisible()) return this.error('password incorrect')

      return this.success('successful unlock existed wallet')
    } catch (e) {
      return this.skip('unlock to account skip') || false
    }
  }

  setPassword = async () => {
    try {
      await this.page.getByPlaceholder('Password must be').fill(this.password)
      await this.page.getByPlaceholder('Confirm Password').fill(this.password)
      await this.page.keyboard.press('Enter')
      await this.page.keyboard.press('Enter')

      this.success('successful another form enter password and confirm')
    } catch (e) {
      this.skip('skip another registration form')
    }
  }

  // Try import private key
  importPrivateKey = async () => {
    try {
      // Try to import
      try {
        await this.page.getByText('Import Address').click()
      } catch (e) {
        this.skip('skip find import address button')
      }
      await this.enterPrivateKey()
      await this.page.getByText('Import Private Key').click()

      this.success('private key imported!')
    } catch (e) {
      this.error('import failture, possible alredy registered')
    }
  }

  enterPrivateKey = async () => {
    try {
      await this.page.getByText('Import Private Key').click()
      await this.setPassword()
      await this.page.getByPlaceholder('Private Key').fill(this.key)
      await this.page.keyboard.press('Enter')
      // await this.page.getByText('Done').click()

      return this.success('success enter private key')
    } catch (e) {
      this.skip('skip enter private key')
    }
  }

  // Get info from wallet
  getInfo = async () => {
    try {
      this.page.setDefaultTimeout(5000)
      // try {
      //   await this.page.locator('.ant-modal-close').click()
      // } catch (e) {}
      const address = await this.page.locator('.address-viewer-text').getAttribute('title')
      const balance = (await this.page.locator('.amount-number').textContent()) || '0'
      if (!address) return this.error(`can't get wallet address from rabby, recheck later.`)

      if (this.address.toLowerCase() !== address.toLowerCase()) {
        this.warning('account address mistmatch!', address, balance)
      } else this.success('balance', c.magenta(balance))

      return {
        address: address,
        balance: parseInt(balance.replace('$', ''))
      }
    } catch (e) {
      this.error('unexpected error', e)
      return false
    }
  }

  // Delete address and clear
  deleteAddress = async () => {
    try {
      // await this.page.locator('ant-modal-close-x').getByLabel('Close').click()
      await this.page.getByText('Addresses').click()
    } catch (e) {
      log(e)
      this.error('delete address failture')
    }
  }

  // Lock Wallet
  lock = async () => {
    try {
      await this.page.getByText('More', { exact: true }).click()
      await this.page.getByText('Lock Wallet').click()
      this.success('wallet locked')
    } catch (error) {
      this.error('lock wallet failture')
    }
  }

  register = async () => {
    try {
      this.l('start working with Rabby Wallet in profile')
      let completed = null
      try {
        await this.page.goto(`chrome-extension://${EXTENSION_ID}/index.html`, { timeout: 5000 })

        this.page.setDefaultTimeout(10000)

        const content = await this.page.locator('#root').innerHTML()
        if (!content && content === '') await this.page.reload()
      } catch (e) {
        throw new Error('Wrong extension ID and Rabby not found!')
      }

      if (await this.page.getByText('Unlock', { exact: true }).isVisible()) await this.unlock()
      else {
        await this.welcome()
        await this.enterPrivateKey()
        await this.page.goto(`chrome-extension://${EXTENSION_ID}/index.html#/dashboard`)
      }

      return await this.getInfo()
    } catch (e) {
      return null
    }
  }
}
