import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Queuewise | Clinic queues, made visible',
  description: 'A live queue and scheduling tool for small clinics.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
