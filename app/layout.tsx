import './globals.css';
import { Mulish, IBM_Plex_Sans_Condensed } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import PageTransition from '@/components/PageTransition';

const mulish = Mulish({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mulish',
});

const ibmPlexCondensed = IBM_Plex_Sans_Condensed({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibm-plex-condensed',
});

export const metadata = {
  title: 'Styllio - Privacy first AI image styling',
  description: 'To be filled',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mulish.variable} ${ibmPlexCondensed.variable}`}>
      <body className={`${mulish.className} sm:px-6`}>
        <ToastProvider>
          <PageTransition>
            {children}
          </PageTransition>
        </ToastProvider>
      </body>
    </html>
  );
}
