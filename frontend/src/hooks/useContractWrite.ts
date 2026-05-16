/**
 * useContractWrite — CyberNodeWorld Yazma Hook'ları
 *
 * Oyundaki tüm on-chain aksiyonları (hack, build, massExtract, upgrade)
 * MetaMask TX onayı ile çalıştırır. Her yazma işlemi sonrası harita
 * verisini otomatik yeniler (refetch).
 *
 * Pattern:
 *   1. useWriteContract() → TX hash üretir
 *   2. useWaitForTransactionReceipt() → TX onayını bekler
 *   3. onSuccess callback → refetch ile haritayı günceller
 */

'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import {
  CYBER_NODE_WORLD_ADDRESS,
  CYBER_NODE_WORLD_ABI,
} from '../config/contracts';

/**
 * CyberNodeWorld kontratına yazma işlemlerini yöneten hook.
 * Tek bir hook ile tüm write fonksiyonlarına erişim sağlar.
 *
 * Kullanım:
 * ```tsx
 * const { hackNode, buildOnNode, extractResources, upgradeNode, isPending, isConfirming, isSuccess, hash } = useGameActions();
 * ```
 */
export function useGameActions() {
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // ── hack(nodeId) ────────────────────────────────────────────────────
  // Boş veya savunmasız bir düğümü ele geçir
  const hackNode = (nodeId: number) => {
    writeContract({
      address: CYBER_NODE_WORLD_ADDRESS as Address,
      abi: CYBER_NODE_WORLD_ABI,
      functionName: 'hack',
      args: [BigInt(nodeId)],
    });
  };

  // ── build(nodeId, buildingType) ─────────────────────────────────────
  // Sahip olduğun boş düğüme bina kur (1=Miner, 2=Firewall, 3=DataCenter)
  const buildOnNode = (nodeId: number, buildingType: number) => {
    writeContract({
      address: CYBER_NODE_WORLD_ADDRESS as Address,
      abi: CYBER_NODE_WORLD_ABI,
      functionName: 'build',
      args: [BigInt(nodeId), buildingType],
    });
  };

  // ── massExtract(subnetId) ───────────────────────────────────────────
  // Bir subnet'teki tüm Miner/DataCenter'lardan kaynak topla
  const extractResources = (subnetId: number) => {
    writeContract({
      address: CYBER_NODE_WORLD_ADDRESS as Address,
      abi: CYBER_NODE_WORLD_ABI,
      functionName: 'massExtract',
      args: [BigInt(subnetId)],
    });
  };

  // ── upgrade(nodeId) ─────────────────────────────────────────────────
  // Mevcut binayı bir seviye yükselt (max level: 10)
  const upgradeNode = (nodeId: number) => {
    writeContract({
      address: CYBER_NODE_WORLD_ADDRESS as Address,
      abi: CYBER_NODE_WORLD_ABI,
      functionName: 'upgrade',
      args: [BigInt(nodeId)],
    });
  };

  return {
    hackNode,
    buildOnNode,
    extractResources,
    upgradeNode,
    hash,
    isPending,      // TX MetaMask'ta onay bekliyor
    isConfirming,   // TX blockchain'de confirm ediliyor
    isSuccess,      // TX başarıyla tamamlandı
    writeError,     // Hata oluştuysa
    reset,          // State'i sıfırla (yeni TX için)
  };
}
