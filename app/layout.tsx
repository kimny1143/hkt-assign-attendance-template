import './globals.css'
import React from 'react'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'HAAS - HKT Assign & Attendance System',
  description: 'Smart crew management for events. First sound, First crew.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HAAS'
  },
  formatDetection: {
    telephone: false
  },
  openGraph: {
    title: 'HAAS - HKT Assign & Attendance System',
    description: 'Smart crew management for events',
    type: 'website',
    siteName: 'HAAS',
    locale: 'ja_JP'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1a1a1a'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HAAS" />
      </head>
      <body>{children}</body>
    </html>
  )
}