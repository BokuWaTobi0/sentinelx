import './globals.css';
export const metadata = { title: 'SentinelX', description: 'Identity-aware security demo' };
export default function Layout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body><main>{children}</main></body></html>;
}
