import type { Metadata } from 'next';
import './globals.css';
import { TopNav } from '@/components/nav';
import { FooterDisclaimer } from '@/components/footer';
import { SWRegister } from '@/components/sw-register';

export const metadata: Metadata = {
  title: '고미술 리스크 스크리닝',
  description: '고미술 진위/위작 리스크 스크리닝 PWA',
  manifest: '/manifest.webmanifest'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SWRegister />
        <TopNav />
        <main className="safe-px mx-auto w-full max-w-xl py-6">{children}</main>
        <FooterDisclaimer />
      </body>
    </html>
  );
}
