import { Providers } from "@/components/providers";
import { Inter } from "next/font/google";
import "./globals.css";

// Move metadata and viewport exports to separate lines with disable comments
// eslint-disable-next-line react-refresh/only-export-components
export { metadata } from "./metadata";
// eslint-disable-next-line react-refresh/only-export-components
export { viewport } from "./metadata";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}