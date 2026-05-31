import { DM_Sans } from 'next/font/google';
import './globals.css';
import AppHeader from '@/components/AppHeader';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

export const metadata = {
  title: 'GrowthLens AI',
  description: 'Resume growth exposure scoring and hiring insights',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">
        <AppHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          GrowthLens AI — employer growth intelligence powered by Crustdata
        </footer>
      </body>
    </html>
  );
}
