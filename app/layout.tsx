import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MedVault | Personal health and clinic services',
  description: 'Keep personal health records organized, track medication reminders, and find participating clinic services.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
