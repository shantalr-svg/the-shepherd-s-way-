// Converts local Zimbabwe numbers (07xx or 077...) to E.164 (+263...)
export function toE164Zimbabwe(raw: string): string {
  const digits = raw.replace(/\D/g, '')

  if (digits.startsWith('263')) return `+${digits}`
  if (digits.startsWith('0')) return `+263${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+263${digits}`

  return `+${digits}`
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}
