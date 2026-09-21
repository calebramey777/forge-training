import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'Forge - Training Tracker',
  description: 'Ironman triathlon training tracker',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#fafafa' }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
