import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata = {
  title: 'pullse',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
