'use client'

interface Props { fullName: string; phone: string; temporaryPassword: string; onClose(): void }

export default function OneTimeCredential({ fullName, phone, temporaryPassword, onClose }: Props) {
  const message = `Welcome to The Shepherd's Way.\nPhone: ${phone}\nTemporary password: ${temporaryPassword}\nSign in and choose a new password immediately.`
  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl p-6 max-w-md w-full">
    <h2 className="text-lg font-bold">Credentials for {fullName}</h2><p className="text-sm text-amber-700 mt-2">Shown once. Send privately, then close this window.</p>
    <pre className="my-4 p-3 bg-stone-100 rounded-lg whitespace-pre-wrap text-sm">{message}</pre>
    <div className="flex gap-2"><button onClick={() => navigator.clipboard.writeText(message)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg">Copy message</button><button onClick={onClose} className="px-4 py-2 border rounded-lg">Close</button></div>
  </div></div>
}
