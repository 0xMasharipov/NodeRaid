/**
 * useContractRead — CyberNodeWorld Okuma Hook'ları
 *
 * Kontrattan harita verisini (8 Subnet × 128 Node) toplu olarak çeker
 * ve NodeLib bit-packing formatını frontend'in anlayacağı NodeData[] formatına
 * dönüştürür.
 *
 * Mimari Karar:
 *   - `getSubnetData(subnetId)` çağrısı 8 kez yapılır (Subnet 0-7).
 *   - Her çağrı 128 adet bytes32 döner → toplam 1024 node.
 *   - bytes32 → { owner, buildingType, level, ... } dönüşümü client-side yapılır.
 *   - Bu yaklaşım getNode()'u 1024 kez çağırmaktan çok daha verimli.
 */

'use client';

import { useReadContracts } from 'wagmi';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import {
  CYBER_NODE_WORLD_ADDRESS,
  CYBER_NODE_WORLD_ABI,
  TOTAL_SUBNETS,
  NODES_PER_SUBNET,
} from '../config/contracts';
import { type NodeData } from '../store/gameStore';

// ── Bit-Packed bytes32 → NodeData Decode ────────────────────────────────
// NodeLib.sol bit layout'una birebir uygun:
//   [0:159]   owner         (address, 20 bytes)
//   [160:167] buildingType  (uint8,   1 byte)
//   [168:175] level         (uint8,   1 byte)
//   [176:183] attackPower   (uint8,   1 byte)
//   [184:191] defensePower  (uint8,   1 byte)
//   [192:255] resources     (uint64,  8 bytes)
function decodePackedNode(packed: bigint, nodeId: number): NodeData {
  const ownerBigInt = packed & ((1n << 160n) - 1n);
  const ownerHex = '0x' + ownerBigInt.toString(16).padStart(40, '0');
  const isEmptyOwner = ownerBigInt === 0n;

  const buildingType = Number((packed >> 160n) & 0xFFn);
  const level = Number((packed >> 168n) & 0xFFn);
  // attackPower ve defensePower şu an UI'da doğrudan kullanılmıyor ama ileride lazım olabilir
  // const attackPower = Number((packed >> 176n) & 0xFFn);
  // const defensePower = Number((packed >> 184n) & 0xFFn);
  const resources = Number((packed >> 192n) & 0xFFFFFFFFFFFFFFFFn);

  return {
    id: nodeId,
    owner: isEmptyOwner ? null : ownerHex,
    username: isEmptyOwner ? null : `${ownerHex.slice(0, 6)}...${ownerHex.slice(-4)}`,
    buildingType,
    level,
    lastHarvestTime: 0, // On-chain'den ayrı çekilecek (lastHarvest mapping)
    uncollectedData: resources,
  };
}

// ── Harita Okuma Hook'u ─────────────────────────────────────────────────
/**
 * 8 Subnet'in tamamını tek bir multicall ile okur ve 1024 NodeData[]'ye dönüştürür.
 *
 * @returns
 *   - mapData: NodeData[] (1024 eleman, decode edilmiş)
 *   - isLoading: Veri henüz gelmediyse true
 *   - isError: RPC hatası olduysa true
 *   - refetch: Manuel yenileme fonksiyonu
 */
export function useMapData() {
  // 8 adet getSubnetData çağrısı oluştur (Subnet 0-7)
  const contracts = Array.from({ length: TOTAL_SUBNETS }, (_, subnetId) => ({
    address: CYBER_NODE_WORLD_ADDRESS as Address,
    abi: CYBER_NODE_WORLD_ABI,
    functionName: 'getSubnetData' as const,
    args: [BigInt(subnetId)] as const,
  }));

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts,
    query: {
      // 30 saniyede bir otomatik yenile (oyuncuların aksiyonlarını yakalamak için)
      refetchInterval: 30_000,
    },
  });

  // Decode: 8 subnet × 128 node = 1024 NodeData
  let mapData: NodeData[] | null = null;

  if (data && data.length === TOTAL_SUBNETS) {
    const allNodes: NodeData[] = [];

    for (let subnetId = 0; subnetId < TOTAL_SUBNETS; subnetId++) {
      const result = data[subnetId];

      if (result.status === 'success' && result.result) {
        // result.result = bytes32[128] array (viem returns bytes32 as hex strings)
        const packedNodes = result.result as readonly string[];

        for (let offset = 0; offset < NODES_PER_SUBNET; offset++) {
          const nodeId = subnetId * NODES_PER_SUBNET + offset;
          // Hex string'i BigInt'e çeviriyoruz (TypeError: Cannot mix BigInt and other types hatasını önlemek için)
          const packed = BigInt(packedNodes[offset]);
          allNodes.push(decodePackedNode(packed, nodeId));
        }
      } else {
        // Subnet okunamazsa boş node'lar ekle
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
/**
 * Bağlı cüzdanın on-chain kaynak bakiyesini okur.
 * playerResources(address) → uint256
 */
export function usePlayerResources() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: address
      ? [
          {
            address: CYBER_NODE_WORLD_ADDRESS as Address,
            abi: CYBER_NODE_WORLD_ABI,
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
