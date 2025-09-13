import './globals.css'
import React from 'react'

export const metadata = { title: 'HKT Assign & Attendance', description: 'Template' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}