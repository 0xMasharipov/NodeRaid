/**
 * CyberNodeWorld Kontrat Yapılandırması
 * 
 * Monad Testnet üzerinde deploy edilmiş CyberNodeWorld kontratının
 * adresi ve ABI tanımları. Frontend hook'ları bu config'i kullanır.
 */

// ── Kontrat Adresi ──────────────────────────────────────────────────────
export const CYBER_NODE_WORLD_ADDRESS = '0xA93CF34Eec6DE68D5C88c7E89b87059CEAe9c79F' as const;

// ── Kontrat ABI (Sadece kullanılan fonksiyonlar) ────────────────────────
// Foundry'nin ürettiği dev ABI yerine, sadece ihtiyacımız olan view/write
// fonksiyonlarını "human-readable" formatta tutuyoruz. Bu yaklaşım:
//   1. Bundle boyutunu küçültür (55KB JSON vs ~2KB)
//   2. Tip güvenliğini korur (Viem otomatik tip çıkarımı yapar)
//   3. Okunabilirliği artırır
export const CYBER_NODE_WORLD_ABI = [
  // ── View Functions (Okuma) ──────────────────────────────────────────
  {
    type: 'function',
    name: 'getNode',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'buildingType', type: 'uint8' },
      { name: 'level', type: 'uint8' },
      { name: 'attackPower', type: 'uint8' },
      { name: 'defensePower', type: 'uint8' },
      { name: 'resources', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubnetData',
    inputs: [{ name: 'subnetId', type: 'uint256' }],
    outputs: [{ name: 'nodes', type: 'bytes32[128]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'playerResources',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastHarvest',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'countPlayerNodes',
    inputs: [
      { name: 'subnetId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ── Write Functions (Yazma — TX gerektirir) ─────────────────────────
  {
    type: 'function',
    name: 'hack',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'build',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'buildingType', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'massExtract',
    inputs: [{ name: 'subnetId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'upgrade',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Events ──────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'NodeHacked',
    inputs: [
      { name: 'nodeId', type: 'uint256', indexed: true },
      { name: 'hacker', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'NodeBuilt',
    inputs: [
      { name: 'nodeId', type: 'uint256', indexed: true },
      { name: 'buildingType', type: 'uint8', indexed: false },
      { name: 'level', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MassExtracted',
    inputs: [
      { name: 'subnetId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'totalResources', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NodeUpgraded',
    inputs: [
      { name: 'nodeId', type: 'uint256', indexed: true },
      { name: 'newLevel', type: 'uint8', indexed: false },
    ],
  },

  // ── Errors ──────────────────────────────────────────────────────────
  {
    type: 'error',
    name: 'InvalidNodeId',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'NodeAlreadyOccupied',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'currentOwner', type: 'address' },
    ],
  },
  {
    type: 'error',
    name: 'NotNodeOwner',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'caller', type: 'address' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidBuildingType',
    inputs: [{ name: 'buildingType', type: 'uint8' }],
  },
  {
    type: 'error',
    name: 'BuildingAlreadyExists',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'currentType', type: 'uint8' },
    ],
  },
  {
    type: 'error',
    name: 'HackDefended',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'defensePower', type: 'uint8' },
    ],
  },
  {
    type: 'error',
    name: 'MaxLevelReached',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'currentLevel', type: 'uint8' },
    ],
  },
] as const;

// ── Sabitler ──────────────────────────────────────────────────────────
export const TOTAL_SUBNETS = 8;
export const NODES_PER_SUBNET = 128;
export const MAX_NODES = 1024;

// ── Bina Tipi Sabitleri ───────────────────────────────────────────────
export const BUILDING_NONE = 0;
export const BUILDING_MINER = 1;
export const BUILDING_FIREWALL = 2;
export const BUILDING_DATACENTER = 3;

// Bina tipi etiketleri
export const BUILDING_LABELS: Record<number, string> = {
  0: 'Empty',
  1: 'Miner',
  2: 'Firewall',
  3: 'DataCenter',
  4: 'Mainframe',
};
