const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%&*?'
const ALL_CHARACTERS = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS

type RandomBytes = (size: number) => Uint8Array

function secureRandomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size))
}

function pick(characters: string, byte: number): string {
  return characters[byte % characters.length]
}

export function generateTemporaryPassword(
  randomBytes: RandomBytes = secureRandomBytes,
): string {
  const bytes = randomBytes(36)
  if (bytes.length < 36) {
    throw new Error('The secure random source returned too few bytes.')
  }

  const characters = [
    pick(LOWERCASE, bytes[0]),
    pick(UPPERCASE, bytes[1]),
    pick(DIGITS, bytes[2]),
    pick(SYMBOLS, bytes[3]),
  ]

  for (let index = 4; index < 18; index += 1) {
    characters.push(pick(ALL_CHARACTERS, bytes[index]))
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = bytes[18 + index] % (index + 1)
    ;[characters[index], characters[target]] = [characters[target], characters[index]]
  }

  return characters.join('')
}

export function validateReplacementPassword(password: string): string | null {
  if (password.length < 12) return 'Password must contain at least 12 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.'
  return null
}
