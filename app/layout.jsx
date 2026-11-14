import './style.css';
export const metadata = { title: 'Hit & Run · Browser Port', description: 'Play with your local PC game files using the existing browser engine' };
export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
