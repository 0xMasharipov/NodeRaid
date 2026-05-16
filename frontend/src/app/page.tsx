import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import HUD from '@/components/HUD';
import './globals.css';

export const metadata: Metadata = {
  title: 'CyberNode — Siber Ağ Haritası',
  description: 'Web3 strategy game map for the Cyber-Node universe on Monad Testnet. Interact with 1024 MIP-8 nodes across 8 subnets.',
};

// Pixi.js uses browser-only APIs → disable SSR via wrapper
import CyberNodeMapWrapper from '@/components/CyberNodeMapWrapper';

export default function HomePage() {
  return (
    <main
      id="main-canvas-wrapper"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#02040f',
      }}
    >
      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        CyberNode — Siber Ağ Haritası
      </h1>

      {/* Full-viewport Pixi.js canvas */}
      <CyberNodeMapWrapper />

      {/* HUD overlay (pure CSS/React, no canvas) */}
      <HUD />
    </main>
  );
}
