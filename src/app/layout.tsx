import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FidesDigital',
  description: 'Sistema SaaS de inventario y catalogación de patrimonio parroquial mediante inteligencia artificial',
  keywords: 'patrimonio, parroquial, inventario, catalogación, arte sacro, IA',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <NavBar />
        {children}
      </body>
    </html>
  )
}