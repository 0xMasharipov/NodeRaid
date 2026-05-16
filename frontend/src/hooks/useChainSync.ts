/**
 * useChainSync — On-Chain ↔ Zustand Senkronizasyonu
 *
 * Bu hook, useMapData() ve usePlayerResources() hook'larından gelen
 * on-chain verileri Zustand gameStore'a aktarır.
 *
 * Neden ayrı bir hook?
 *   - Separation of Concerns: Okuma logic'i (useContractRead) ile
 *     state yönetimi (Zustand) birbirinden ayrılır.
 *   - Tek noktadan güncelleme: Harita verisi değiştiğinde tek bir yerde
 *     Zustand güncellemesi yapılır.
 *   - İleride WebSocket/Event listener eklendiğinde bu hook genişletilir.
 *
 * Kullanım:
 *   Sadece page.tsx veya layout seviyesinde bir kez çağır.
 *   ```tsx
 *   useChainSync();
 *   ```
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useMapData, usePlayerResources } from './useContractRead';
import { useGameStore } from '../store/gameStore';

export function useChainSync() {
  const { address } = useAccount();
  const { mapData: onChainMap, isLoading, refetch: refetchMap } = useMapData();
  const { resources: onChainResources, refetch: refetchResources } = usePlayerResources();

  const { setMapData, setCurrentPlayer } = useGameStore();
  const addGlobalResource = useGameStore((s) => s.addGlobalResource);

  // On-chain harita verisi geldiğinde Zustand'ı güncelle
  const prevMapRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onChainMap || onChainMap.length === 0) return;

    // Gereksiz re-render'ları önlemek için basit hash karşılaştırması
    const mapHash = onChainMap
      .filter((n) => n.owner !== null)
      .map((n) => `${n.id}:${n.owner}:${n.buildingType}:${n.level}`)
      .join('|');

    if (mapHash !== prevMapRef.current) {
      prevMapRef.current = mapHash;
      setMapData(onChainMap);
    }
  }, [onChainMap, setMapData]);

  // On-chain kaynakları Zustand'a aktar
  useEffect(() => {
    if (onChainResources !== undefined && onChainResources > 0) {
      // globalResources'u on-chain değeriyle senkronize et
      const currentResources = useGameStore.getState().globalResources;
      if (currentResources !== onChainResources) {
        // Farkı hesapla ve güncelle (addGlobalResource yerine doğrudan set)
        useGameStore.setState({ globalResources: onChainResources });
      }
    }
  }, [onChainResources]);

  // Cüzdan adresini Zustand'a aktar
  useEffect(() => {
    setCurrentPlayer(address ?? null);
  }, [address, setCurrentPlayer]);

  return {
    isLoading,
    refetchMap,
    refetchResources,
    isConnected: !!address,
  };
}
