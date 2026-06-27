import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import type { Metadata } from "next"

import "@opencal/ui/globals.css"
import "./calendar.css"
import { ConvexClientProvider } from "@/components/convex-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@opencal/ui/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "OpenCal — Online Scheduling for Wellness Businesses",
    template: "%s — OpenCal",
  },
  description:
    "OpenCal is free online scheduling for fitness, wellness and performance businesses in South-East Asia. Book appointments, manage your team, and grow your business.",
  metadataBase: new URL("https://opencal.xyz"),
  openGraph: {
    type: "website",
    siteName: "OpenCal",
    title: "OpenCal — Online Scheduling for Wellness Businesses",
    description:
      "Free online scheduling for fitness, wellness and performance businesses in South-East Asia.",
    url: "https://opencal.xyz",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenCal — Online Scheduling for Wellness Businesses",
    description:
      "Free online scheduling for fitness, wellness and performance businesses in South-East Asia.",
  },
  applicationName: "OpenCal",
}

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ConvexClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ConvexClientProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
