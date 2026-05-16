'use client';

/**
 * ChainSyncProvider — On-chain veriyi Zustand'a aktaran görünmez bileşen.
 *
 * Neden ayrı bir bileşen?
 *   HUD, Zustand'ın mapData, globalResources gibi state'lerine subscribe olur.
 *   Eğer useChainSync() da HUD içinde çağrılırsa:
 *     1. On-chain veri gelir → setMapData() → Zustand güncellenir
 *     2. HUD re-render olur (mapData değişti)
 *     3. useChainSync() tekrar çalışır → yeni mapData alır → setMapData() ...
 *     → Sonsuz re-render döngüsü + Turbopack FATAL crash
 *
 *   Bu bileşen hiçbir Zustand state'ine subscribe olmaz, sadece yazma yapar.
 *   Dolayısıyla Zustand güncellemeleri bu bileşeni re-render etmez.
 */

import { useChainSync } from '../hooks/useChainSync';

export default function ChainSyncProvider() {
  useChainSync();
  return null; // Görünmez bileşen — DOM'a hiçbir şey eklemez
}
