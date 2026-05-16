import { create } from 'zustand';

export interface NodeData {
  id: number;
  owner: string | null;
  username: string | null;
  buildingType: number; // 0=Empty, 1=Miner, 2=Firewall, 3=DataCenter, 4=Mainframe
  level: number;
  lastHarvestTime: number;
  uncollectedData: number;
}

export interface DataLog {
  id: string;
  amount: number;
  timestamp: number;
}

export interface GameState {
  mapData: NodeData[];
  globalResources: number; // Cüzdanda biriken toplam DATA sayısı
  selectedNodeId: number | null;
  dataLogs: DataLog[];
  currentPlayer: string | null;
  setCurrentPlayer: (address: string | null) => void;
  setMapData: (data: NodeData[]) => void;
  updateNode: (id: number, updates: Partial<NodeData>) => void;
  setSelectedNodeId: (id: number | null) => void;
  collectData: () => void;
  destroyNode: (id: number) => void;
  addGlobalResource: (amount: number) => void;
  tickMiners: () => void;
  buildNode: (id: number, buildingType: number, cost: number) => void;
}

// Boş 1024-node haritası oluştur. On-chain veri useChainSync ile doldurulur.
const generateEmptyMapData = (): NodeData[] => {
  const data: NodeData[] = [];
  for (let i = 0; i < 1024; i++) {
    data.push({
      id: i,
      owner: null,
      username: null,
      buildingType: 0,
      level: 0,
      lastHarvestTime: 0,
      uncollectedData: 0,
    });
  }
  return data;
};

export const useGameStore = create<GameState>((set) => ({
  mapData: generateEmptyMapData(),
  globalResources: 0, // On-chain'den useChainSync ile senkronize edilir
  selectedNodeId: null,
  dataLogs: [],
  currentPlayer: null,

  setCurrentPlayer: (address) => set({ currentPlayer: address }),

  setMapData: (data) => set({ mapData: data }),

  updateNode: (id, updates) =>
    set((state) => ({
      mapData: state.mapData.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    })),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  collectData: () =>
    set((state) => {
      if (!state.currentPlayer) return state;
      const myAddr = state.currentPlayer.toLowerCase();
      const now = Date.now();
      let totalDataToCollect = 0;

      const updatedMapData = state.mapData.map((node) => {
        if (node.buildingType === 1 && node.owner && node.owner.toLowerCase() === myAddr) {
          const dataToCollect = node.uncollectedData;
          if (dataToCollect > 0) {
            totalDataToCollect += dataToCollect;
            return { ...node, lastHarvestTime: now, uncollectedData: 0 };
          }
        }
        return node;
      });

      if (totalDataToCollect === 0) return state;

      const newLog: DataLog = {
        id: Math.random().toString(36).substring(2, 11),
        amount: totalDataToCollect,
        timestamp: now,
      };

      return {
        mapData: updatedMapData,
        globalResources: state.globalResources + totalDataToCollect,
        dataLogs: [newLog, ...state.dataLogs].slice(0, 10),
      };
    }),

  addGlobalResource: (amount) => set((state) => ({ globalResources: state.globalResources + amount })),

  tickMiners: () => set((state) => state),

  buildNode: (id, buildingType, _cost) =>
    set((state) => {
      if (!state.currentPlayer) return state;

      const updatedMapData = state.mapData.map((node) => {
        if (node.id === id && node.buildingType === 0) {
          return {
            ...node,
            owner: state.currentPlayer,
            username: `${state.currentPlayer!.slice(0, 6)}...${state.currentPlayer!.slice(-4)}`,
            buildingType,
            level: 1,
            lastHarvestTime: Date.now(),
            uncollectedData: 0,
          };
        }
        return node;
      });

      return { mapData: updatedMapData };
    }),

  destroyNode: (id) =>
    set((state) => {
      if (!state.currentPlayer) return state;
      const myAddr = state.currentPlayer.toLowerCase();
      const node = state.mapData.find((n) => n.id === id);
      if (!node || !node.owner || node.owner.toLowerCase() !== myAddr || node.buildingType === 0) return state;

      const updatedMapData = state.mapData.map((n) =>
        n.id === id
          ? {
            ...n,
            owner: null,
            username: null,
            buildingType: 0,
            level: 0,
            lastHarvestTime: Date.now(),
            uncollectedData: 0,
          }
          : n
      );

      return { mapData: updatedMapData };
    })
}));
