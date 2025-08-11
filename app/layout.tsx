import './globals.css';
import { Mulish } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';

const mulish = Mulish({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Styllio - AI Powered Image Styling',
  description: 'To be filled',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={mulish.className}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
