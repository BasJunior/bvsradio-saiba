import type { Metadata } from 'next';
import './library.css';

export const metadata: Metadata = { title: 'Your Library' };

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
