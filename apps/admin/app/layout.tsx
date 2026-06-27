import { Geist, Geist_Mono } from "next/font/google";
import "@opencal/ui/globals.css";
import { ConvexClientProvider } from "@/components/convex-provider";
import { GoogleMapsProvider } from "@/components/google-maps-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemedToaster } from "@/components/themed-toaster";
import { cn } from "@opencal/ui/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "OpenCal Admin",
  description: "Admin dashboard for OpenCal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          <ConvexClientProvider>
            <GoogleMapsProvider>{children}</GoogleMapsProvider>
          </ConvexClientProvider>
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
