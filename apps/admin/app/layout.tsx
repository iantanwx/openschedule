import { Geist, Geist_Mono } from "next/font/google";
import "@openschedule/ui/globals.css";
import { ConvexClientProvider } from "@/components/convex-provider";
import { cn } from "@openschedule/ui/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "OpenSchedule Admin",
  description: "Admin dashboard for OpenSchedule",
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
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
