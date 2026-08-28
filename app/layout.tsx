import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import QueryProvider from '@/providers/query-provider';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'RailRadar 24 — Live Indian Railways Tracking & Intelligence',
  description:
    'Live train tracking, PNR confirmation prediction, fares, 14-day seat calendar, station FIDS boards, and journey planning — built on RailRadar APIs.',
  keywords: ['RailRadar 24', 'RailRadar', 'PNR status', 'live train status', 'Indian Railways', 'seat availability', 'train fare', 'station board'],
  authors: [{ name: 'RailRadar 24' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RailRadar 24',
  },
  openGraph: {
    title: 'RailRadar 24 — Live Indian Railways Tracking & Intelligence',
    description: 'Real-time tracking, PNR prediction, fares, seats, and live station boards.',
    type: 'website',
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  themeColor: '#0284c7',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://api.railradar.in" />
        <link rel="preconnect" href="https://api.maptiler.com" />
        <link rel="preconnect" href="https://api.openweathermap.org" />
      </head>
      <body
        className={`${inter.className} min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100`}
      >
        <QueryProvider>
          <Navbar />
          <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full pb-24 md:pb-6">
            {children}
          </main>
          <BottomNav />
        </QueryProvider>
      </body>
    </html>
  );
}
