'use client';

import dynamic from 'next/dynamic';
import ChainSyncProvider from './ChainSyncProvider';

const CyberNodeMap = dynamic(() => import('./CyberNodeMap'), { ssr: false });

export default function CyberNodeMapWrapper() {
  return (
    <>
      {/* On-chain ↔ Zustand senkronizasyonu (görünmez, DOM'a ekleme yapmaz) */}
      <ChainSyncProvider />
      <CyberNodeMap />
    </>
  );
}
