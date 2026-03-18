// src/app/layout.tsx
import type { Metadata } from "next"
import { Archivo, Space_Mono } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
})

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Tracker Tracker",
  description: "Monitor your private tracker stats",
  icons: {
    icon: "/favicon.png",
  },
  ...(process.env.BASE_URL && {
    metadataBase: new URL(process.env.BASE_URL),
  }),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${archivo.variable} ${spaceMono.variable} font-sans antialiased bg-base text-primary`}
      >
        {children}
      </body>
    </html>
  )
}
