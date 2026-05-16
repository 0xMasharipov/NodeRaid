'use client';

import { useReadContracts, useReadContract } from 'wagmi';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import {
  CYBER_NODE_GAME_ADDRESS,
  CYBER_NODE_GAME_ABI,
  TOTAL_SUBNETS,
  NODES_PER_SUBNET,
} from '../config/contracts';
import { type NodeData } from '../store/gameStore';

// ── Bit-Packed bytes32 → NodeData Decode ────────────────────────────────
function decodePackedNode(packed: bigint, nodeId: number): NodeData {
  const ownerBigInt = packed & ((BigInt(1) << BigInt(160)) - BigInt(1));
  const ownerHex = '0x' + ownerBigInt.toString(16).padStart(40, '0');
  const isEmptyOwner = ownerBigInt === BigInt(0);

  const buildingType = Number((packed >> BigInt(160)) & BigInt(0xFF));
  const level = Number((packed >> BigInt(168)) & BigInt(0xFF));
  const resources = Number((packed >> BigInt(192)) & BigInt(0xFFFFFFFFFFFFFFFF));

  return {
    id: nodeId,
    owner: isEmptyOwner ? null : ownerHex,
    username: isEmptyOwner ? null : `${ownerHex.slice(0, 6)}...${ownerHex.slice(-4)}`,
    buildingType,
    level,
    lastHarvestTime: 0,
    uncollectedData: resources,
  };
}

// ── Harita Okuma Hook'u ─────────────────────────────────────────────────
export function useMapData() {
  const contracts = Array.from({ length: TOTAL_SUBNETS }, (_, subnetId) => ({
    address: CYBER_NODE_GAME_ADDRESS as Address,
    abi: CYBER_NODE_GAME_ABI,
    functionName: 'getSubnetData' as const,
    args: [BigInt(subnetId)] as const,
  }));

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts,
    query: {
      refetchInterval: 30_000,
    },
  });

  let mapData: NodeData[] | null = null;

  if (data && data.length === TOTAL_SUBNETS) {
    const allNodes: NodeData[] = [];

    for (let subnetId = 0; subnetId < TOTAL_SUBNETS; subnetId++) {
      const result = data[subnetId];

      if (result.status === 'success' && result.result) {
        const packedNodes = result.result as readonly string[];

        for (let offset = 0; offset < NODES_PER_SUBNET; offset++) {
          const nodeId = subnetId * NODES_PER_SUBNET + offset;
          const packed = BigInt(packedNodes[offset]);
          allNodes.push(decodePackedNode(packed, nodeId));
        }
      } else {
        for (let offset = 0; offset < NODES_PER_SUBNET; offset++) {
          const nodeId = subnetId * NODES_PER_SUBNET + offset;
          allNodes.push({
            id: nodeId,
            owner: null,
            username: null,
            buildingType: 0,
            level: 0,
            lastHarvestTime: 0,
            uncollectedData: 0,
          });
        }
      }
    }

    mapData = allNodes;
  }

  return { mapData, isLoading, isError, refetch };
}

// ── Oyuncu Kaynakları Okuma Hook'u ──────────────────────────────────────
export function usePlayerResources() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: address
      ? [
          {
            address: CYBER_NODE_GAME_ADDRESS as Address,
            abi: CYBER_NODE_GAME_ABI,
            functionName: 'playerResources' as const,
            args: [address] as const,
          },
        ]
      : [],
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
    },
  });

  const resources =
    data && data[0]?.status === 'success' ? Number(data[0].result as bigint) : 0;

  return { resources, isLoading, refetch };
}

// ── Oyuncu Başlatılmış mı? ──────────────────────────────────────────────
export function usePlayerInitialized() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContract({
    address: CYBER_NODE_GAME_ADDRESS as Address,
    abi: CYBER_NODE_GAME_ABI,
    functionName: 'isPlayerInitialized',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    isInitialized: !!data,
    isLoading,
    refetch,
  };
}

// ── Oyuncunun Mainframe Node ID'si ──────────────────────────────────────
export function usePlayerMainframe() {
  const { address } = useAccount();

  const { data, isLoading } = useReadContract({
    address: CYBER_NODE_GAME_ADDRESS as Address,
    abi: CYBER_NODE_GAME_ABI,
    functionName: 'getPlayerMainframe',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    mainframeNodeId: data ? Number(data as bigint) : null,
    isLoading,
  };
}
