import { wait } from '../utils'
import c from 'chalk'
import axios from 'axios'
import { Browser, chromium } from 'playwright'
import { log } from 'console'

let HEADLESS = process.env.HEADLESS == 'true' ? 1 : 0
HEADLESS = 0
console.log(HEADLESS === 1 ? 'Without GUI' : 'With GUI')

const AdsPowerLocalApi = axios.create({
  baseURL: 'http://local.adspower.net:50325/api/v1/'
})

let GROUP_ID
AdsPowerLocalApi.post('group/create', { group_name: 'AutoGenerated' })
  .then(async (r) => {
    if (r.data.code === 8544) {
      await wait(1000)
      return AdsPowerLocalApi.get('group/list?group_name=Rabby').then((r) => r.data.data.list[0].group_id)
    }
    return r.data.data.group_id
  })
  .catch((e) => {})

export const AdsPowerStatus = async () =>
  AdsPowerLocalApi.get('http://local.adspower.net:50325/status').then((r) => {
    if (r.data.code === 0) log('AdsPower Local Api Enabled')
    else throw new Error('Setup Local Api in Adspower settings')
  })

export class AdsProfile {
  user: any = {}
  browser: Browser

  constructor(user) {
    if (user.id) user.user_id = user.id
    this.user = user
  }

  l(...args): false {
    var args = Array.from(args)
    args.unshift(c.cyan(`Profile ${this.user?.serial_number || this.user?.user_id || 'NEW'}:`))
    return console.log.apply(console, args)
  }

  create = async (id): Promise<any> =>
    AdsPowerLocalApi.post(`user/create`, {
      serial_number: id,
      group_id: GROUP_ID,
      user_proxy_config: { proxy_soft: 'no_proxy' },
      fingerprint_config: {
        automatic_timezone: '1',
        language: ['en-US', 'en', 'zh-CN', 'zh'],
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141',
        flash: 'block',
        webrtc: 'disabled'
      }
    }).then((r) => {
      if (r.data.code !== 0) return this.l(c.red('user create failed', r.data.msg))

      this.user = {
        user_id: r.data.data.id,
        serial_number: r.data.data.serial_number
      }

      return this.l(c.magenta('created new AdsPower profile:', this.user.serial_number))
    })

  delete = async (): Promise<any> =>
    AdsPowerLocalApi.post(`user/delete`, { user_ids: [this.user.user_id] }).then((r) => {
      if (r.data.code === 0) this.l('user deleted')
      return r.data.code === 0
    })

  open = async (): Promise<Browser | undefined> => {
    try {
      this.l('try to open browser')
      const launchArgs = []

      launchArgs.push('--disable-popup-blocking')
      launchArgs.push('--disable-web-security')
      launchArgs.push('--disable-features=IsolateOrigins,site-per-process')

      // if (HEADLESS === 1) {
      // launchArgs.push(`--headless=new`)
      // launchArgs.push(`--disable-extensions-except=${EXTENSION_URL}`)
      // launchArgs.push(`--load-extension=${EXTENSION_URL}`)
      // }

      const params = {
        user_id: this.user.user_id,
        serial_number: this.user.serial_number || '',
        open_tabs: 0,
        launch_args: JSON.stringify(launchArgs),
        headless: HEADLESS
      }

      const connection = await AdsPowerLocalApi('browser/start', { params })

      if (connection?.data?.code !== 0) {
        this.l('connection error:', c.red(connection.data.msg))
        return
      }

      const endpoint = connection.data.data.ws.puppeteer
      this.l(c.yellow('WebSocket endpoint:', endpoint))
      const browser = await chromium.connectOverCDP(endpoint, { slowMo: 0 })

      return browser
    } catch (e) {
      await this.close()
      this.l(c.red('error with connecting to AdsPower API:'), e)
      return undefined
    }
  }

  close = async (): Promise<boolean> => {
    const params = this.user
    return AdsPowerLocalApi.get(`browser/stop`, { params }).then((r) => {
      if (r.data.code !== 0) return this.l(c.red('failed to close browser'), r.data.msg)

      return this.l(c.green('profile closed'))
    })
  }

  isActive = async (): Promise<boolean> => {
    const params = this.user
    return AdsPowerLocalApi.get(`browser/active`, { params }).then((r) => {
      if (r.data.code !== 0) return this.l(c.red('failed to check profile activity'), r.data.msg)

      return r.data.code === 0 && r.data.data.status === 'Active'
    })
  }
}

export const getExistedAccounts = async (perPage = 50) => {
  let accounts: any[] = []
  let page = 1

  do {
    const accs = await AdsPowerLocalApi(`user/list?page_size=${perPage}&page=${page}`).then((r) => r.data)
    if (accs.data && accs.data.list.length === 0) break
    else if (accs.code === 0 && accs.data.list.length > 0) {
      accounts = accounts.concat(accs.data.list)
      page++
    }
    await wait(1000)
  } while (true)

  return accounts
}
