import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sovereign Markets — Intraday Intelligence Terminal',
  description: 'AI-powered day trading insights and chart analysis. A Sovereign Shield Technologies product.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
