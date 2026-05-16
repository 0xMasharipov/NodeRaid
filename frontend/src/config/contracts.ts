/**
 * CyberNodeGame Kontrat Yapılandırması
 *
 * Deploy edildikten sonra CYBER_NODE_GAME_ADDRESS güncellenmeli!
 */

// ── Kontrat Adresi (deploy sonrası güncelle!) ───────────────────────────
export const CYBER_NODE_GAME_ADDRESS = '0x81f7D4dba4028Ae8AC80D2b37544966a41F4e07E' as const;

// Eski adres referansı (geriye uyumluluk için)
export const CYBER_NODE_WORLD_ADDRESS = CYBER_NODE_GAME_ADDRESS;

// ── Kontrat ABI ─────────────────────────────────────────────────────────
export const CYBER_NODE_GAME_ABI = [
  // ── Player Init ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'initPlayer',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isPlayerInitialized',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPlayerMainframe',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ── View Functions ─────────────────────────────────────────────────────
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

  // ── Write Functions ────────────────────────────────────────────────────
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
  {
    type: 'function',
    name: 'destroyFirewall',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Events ─────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'PlayerInitialized',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'mainframeNodeId', type: 'uint256', indexed: false },
      { name: 'subnetId', type: 'uint256', indexed: false },
    ],
  },
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
  {
    type: 'event',
    name: 'FirewallDestroyed',
    inputs: [
      { name: 'nodeId', type: 'uint256', indexed: true },
      { name: 'attacker', type: 'address', indexed: true },
    ],
  },

  // ── Errors ─────────────────────────────────────────────────────────────
  {
    type: 'error',
    name: 'AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitialized',
    inputs: [],
  },
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
    name: 'InvalidSubnetId',
    inputs: [{ name: 'subnetId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'MaxLevelReached',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'currentLevel', type: 'uint8' },
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
    name: 'InsufficientResources',
    inputs: [
      { name: 'required', type: 'uint256' },
      { name: 'available', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'NotInYourSubnet',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'yourSubnet', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'NotAFirewall',
    inputs: [
      { name: 'nodeId', type: 'uint256' },
      { name: 'actualType', type: 'uint8' },
    ],
  },
  {
    type: 'error',
    name: 'CannotHackMainframe',
    inputs: [{ name: 'nodeId', type: 'uint256' }],
  },
] as const;

// Eski referans (geriye uyumluluk)
export const CYBER_NODE_WORLD_ABI = CYBER_NODE_GAME_ABI;

// ── Sabitler ─────────────────────────────────────────────────────────────
export const TOTAL_SUBNETS = 8;
export const NODES_PER_SUBNET = 128;
export const MAX_NODES = 1024;

// ── Bina Tipi Sabitleri ──────────────────────────────────────────────────
export const BUILDING_NONE = 0;
export const BUILDING_MINER = 1;
export const BUILDING_FIREWALL = 2;
export const BUILDING_DATACENTER = 3;
export const BUILDING_MAINFRAME = 4;

// ── Bina Maliyetleri ─────────────────────────────────────────────────────
export const COST_MAINFRAME = 500;
export const COST_MINER = 200;
export const COST_FIREWALL = 300;
export const COST_DATACENTER = 400;

// Bina tipi etiketleri
export const BUILDING_LABELS: Record<number, string> = {
  0: 'Empty',
  1: 'Miner',
  2: 'Firewall',
  3: 'DataCenter',
  4: 'Mainframe',
};
