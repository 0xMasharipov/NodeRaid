'use client';

import { useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import {
  CYBER_NODE_GAME_ADDRESS,
  CYBER_NODE_GAME_ABI,
} from '../config/contracts';
import { useMapData, usePlayerResources } from './useContractRead';

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

  const { refetch: refetchMap } = useMapData();
  const { refetch: refetchResources } = usePlayerResources();

  useEffect(() => {
    if (isSuccess) {
      refetchMap();
      refetchResources();
    }
  }, [isSuccess, refetchMap, refetchResources]);

  // ── initPlayer(nodeId) — Oyunu başlat, Mainframe kur ───────────────────
  const initPlayer = (nodeId: number) => {
    writeContract({
      address: CYBER_NODE_GAME_ADDRESS as Address,
      abi: CYBER_NODE_GAME_ABI,
      functionName: 'initPlayer',
      args: [BigInt(nodeId)],
      gas: BigInt(500_000),
    });
  };

  // ── hack(nodeId) ────────────────────────────────────────────────────────
  const hackNode = (nodeId: number) => {
    writeContract({
      address: CYBER_NODE_GAME_ADDRESS as Address,
      abi: CYBER_NODE_GAME_ABI,
      functionName: 'hack',
      args: [BigInt(nodeId)],
      gas: BigInt(200_000),
    });
  };

  // ── build(nodeId, buildingType) ─────────────────────────────────────────
  const buildOnNode = (nodeId: number, buildingType: number) => {
    writeContract({
      address: CYBER_NODE_GAME_ADDRESS as Address,
      abi: CYBER_NODE_GAME_ABI,
      functionName: 'build',
      args: [BigInt(nodeId), buildingType],
      gas: BigInt(200_000),
    });
  };

  // ── massExtract(subnetId) ───────────────────────────────────────────────
  const extractResources = (subnetId: number) => {
    writeContract({
      address: CYBER_NODE_GAME_ADDRESS as Address,
      abi: CYBER_NODE_GAME_ABI,
      functionName: 'massExtract',
      args: [BigInt(subnetId)],
      gas: BigInt(5_000_000),
    });
  };

  // ── upgrade(nodeId) ─────────────────────────────────────────────────────
  const upgradeNode = (nodeId: number) => {
    writeContract({
      address: CYBER_NODE_GAME_ADDRESS as Address,
      abi: CYBER_NODE_GAME_ABI,
      functionName: 'upgrade',
      args: [BigInt(nodeId)],
      gas: BigInt(200_000),
    });
  };

  // ── destroyFirewall(nodeId) — Hack aşama 1 ─────────────────────────────
  const destroyFirewall = (nodeId: number) => {
    writeContract({
      address: CYBER_NODE_GAME_ADDRESS as Address,
      abi: CYBER_NODE_GAME_ABI,
      functionName: 'destroyFirewall',
      args: [BigInt(nodeId)],
      gas: BigInt(200_000),
    });
  };

  return {
    initPlayer,
    hackNode,
    buildOnNode,
    extractResources,
    upgradeNode,
    destroyFirewall,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    writeError,
    reset,
  };
}
