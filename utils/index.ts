import c from 'chalk'

// Waiter
export const wait = async (ms: number) => new Promise((r) => setTimeout(r, ms))

// logger
export const hex = (address: string) => c.hex('#' + address.slice(-6))(address) + c.white(':')
