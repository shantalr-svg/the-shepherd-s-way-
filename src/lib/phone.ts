const ZIMBABWE_MOBILE_PATTERN = /^\+2637\d{8}$/

const INVALID_PHONE_MESSAGE =
  'Enter a valid Zimbabwean mobile number, for example 077 282 9203.'

export function normalizeZimbabwePhone(input: string): string {
  const compact = input.trim().replace(/[\s\-()]/g, '')

  let normalized = compact
  if (/^0\d+$/.test(compact)) {
    normalized = `+263${compact.slice(1)}`
  } else if (/^263\d+$/.test(compact)) {
    normalized = `+${compact}`
  }

  if (!ZIMBABWE_MOBILE_PATTERN.test(normalized)) {
    throw new Error(INVALID_PHONE_MESSAGE)
  }

  return normalized
}

export function formatZimbabwePhone(input: string): string {
  const normalized = normalizeZimbabwePhone(input)
  return normalized.replace(/^(\+263)(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3 $4')
}
