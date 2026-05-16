// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title NaiveWorld — Standard Mapping-Based World (MIP-8 Anti-Pattern)
/// @author Cyber-Node Team
/// @notice MIP-8 optimizasyonu YAPILMAMIŞ karşılaştırma kontratı.
///         Her düğüm ayrı bir storage slot'ta (keccak256-hashed key) saklanır,
///         bu yüzden her okuma ayrı bir MIP-8 page'inden cold load gerektirir.
/// @dev Bu kontrat, CyberNodeWorld ile gas karşılaştırması yapmak için kullanılır.
///      ⚠️  Üretim amaçlı DEĞİLDİR — sadece benchmark referansıdır.
///
///      Gas Comparison (massExtract, 128 nodes):
///        NaiveWorld:     128 × cold load = 128 × 8100 = 1,036,800 gas (MIP-8)
///        CyberNodeWorld: 1 cold + 127 warm = 8100 + 12700 = 20,800 gas (MIP-8)
///        Fark:           ~50x
contract NaiveWorld {
    /*//////////////////////////////////////////////////////////////
                              DATA STRUCTURES
    //////////////////////////////////////////////////////////////*/

    /// @notice Standart Solidity struct — her alan ayrı bir slot.
    /// @dev mapping(uint256 => Node) kullanıldığında keccak256 ile hash'lenir
    ///      ve her node farklı bir storage page'e dağılır.
    struct Node {
        address owner;       // slot 0 (keccak256(nodeId, slot))
        uint8 buildingType;  // packed with owner (aynı slot)
        uint8 level;         // packed with owner (aynı slot)
        uint8 attackPower;   // packed with owner (aynı slot)
        uint8 defensePower;  // packed with owner (aynı slot)
        uint64 resources;    // slot 1 (keccak256(nodeId, slot) + 1)
        uint256 lastHarvest; // slot 2 (keccak256(nodeId, slot) + 2)
    }

    /*//////////////////////////////////////////////////////////////
                               STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Standart mapping — her düğüm ayrı bir hash'lenmiş konumda.
    /// @dev ⚠️  Bu layout MIP-8 page warming'den yararlanamaz çünkü
    ///      nodeId 0 ve nodeId 1'in storage konumları birbirinden uzaktır:
    ///      keccak256(0, slot) ≠ keccak256(1, slot) + 1
    mapping(uint256 => Node) public nodes;

    /// @notice Oyuncuların toplam biriken kaynakları.
    mapping(address => uint256) public playerResources;

    uint256 public constant MAX_NODES = 1024;

    /// @notice Miner bina tipi için seviye başına kaynak üretim oranı (birim/saniye).
    uint64 public constant MINER_BASE_RATE = 10;

    /// @notice DataCenter bina tipi için seviye başına kaynak üretim oranı (birim/saniye).
    uint64 public constant DATACENTER_BASE_RATE = 25;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event NodeHacked(uint256 indexed nodeId, address indexed hacker);
    event NodeBuilt(uint256 indexed nodeId, uint8 buildingType, uint8 level);
    event MassExtracted(uint256 indexed startId, address indexed player, uint256 totalResources);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidNodeId(uint256 nodeId);
    error NodeAlreadyOccupied(uint256 nodeId, address currentOwner);
    error NotNodeOwner(uint256 nodeId, address caller);
    error InvalidBuildingType(uint8 buildingType);
    error BuildingAlreadyExists(uint256 nodeId, uint8 currentType);
    error HackDefended(uint256 nodeId, uint8 defensePower);

    /*//////////////////////////////////////////////////////////////
                            CORE GAME FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Boş bir düğümü ele geçir (hack).
    /// @dev Her okuma ayrı bir page'den cold load — MIP-8 avantajı YOK.
    /// @param nodeId Hedef düğümün ID'si (0-1023)
    function hack(uint256 nodeId) external {
        if (nodeId >= MAX_NODES) revert InvalidNodeId(nodeId);

        Node storage node = nodes[nodeId];

        if (node.owner != address(0)) {
            if (node.owner == msg.sender) {
                revert NodeAlreadyOccupied(nodeId, node.owner);
            }

            // Firewall kontrolü
            if (node.defensePower > 0) {
                revert HackDefended(nodeId, node.defensePower);
            }

            // Kaynakları eski sahibine aktar
            _harvestSingleNode(nodeId);

            // Düğümü sıfırla
            node.owner = msg.sender;
            node.buildingType = 0;
            node.level = 0;
            node.attackPower = 0;
            node.defensePower = 0;
            node.resources = 0;
            node.lastHarvest = block.timestamp;
        } else {
            node.owner = msg.sender;
            node.lastHarvest = block.timestamp;
        }

        emit NodeHacked(nodeId, msg.sender);
    }

    /// @notice Sahip olduğun düğüm üzerine bina kur.
    /// @param nodeId Hedef düğümün ID'si (0-1023)
    /// @param buildingType Kurulacak bina tipi (1=Miner, 2=Firewall, 3=DataCenter)
    function build(uint256 nodeId, uint8 buildingType) external {
        if (nodeId >= MAX_NODES) revert InvalidNodeId(nodeId);
        if (buildingType == 0 || buildingType > 3) revert InvalidBuildingType(buildingType);

        Node storage node = nodes[nodeId];
        if (node.owner != msg.sender) revert NotNodeOwner(nodeId, msg.sender);
        if (node.buildingType != 0) revert BuildingAlreadyExists(nodeId, node.buildingType);

        node.buildingType = buildingType;
        node.level = 1;
        node.lastHarvest = block.timestamp;

        if (buildingType == 2) {
            // Firewall
            node.defensePower = 10;
        } else if (buildingType == 3) {
            // DataCenter
            node.defensePower = 5;
        }

        emit NodeBuilt(nodeId, buildingType, 1);
    }

    /// @notice Belirli aralıktaki tüm düğümlerden kaynak topla.
    /// @dev ⚠️  Her SLOAD ayrı bir page'den cold read yapar.
    ///      128 düğüm × cold load = çok pahalı!
    ///      MIP-8 page warming avantajı KULLANILMAZ.
    /// @param startId Başlangıç düğüm ID'si
    /// @param count Toplanacak düğüm sayısı
    function massExtract(uint256 startId, uint256 count) external {
        if (startId + count > MAX_NODES) revert InvalidNodeId(startId + count);

        uint256 totalProduced;

        // ⚠️  Her iteration ayrı bir storage page'den cold okuma yapar
        for (uint256 i; i < count;) {
            uint256 nodeId = startId + i;
            Node storage node = nodes[nodeId];

            if (node.owner == msg.sender) {
                uint256 lastTime = node.lastHarvest;
                uint256 elapsed;

                if (lastTime > 0 && block.timestamp > lastTime) {
                    elapsed = block.timestamp - lastTime;
                }

                if (elapsed > 0) {
                    uint64 produced = _calculateProduction(node.buildingType, node.level, elapsed);
                    if (produced > 0) {
                        node.resources += produced;
                        totalProduced += produced;
                    }
                }
                node.lastHarvest = block.timestamp;
            }

            unchecked { ++i; }
        }

        if (totalProduced > 0) {
            playerResources[msg.sender] += totalProduced;
        }

        emit MassExtracted(startId, msg.sender, totalProduced);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Belirli bir düğümün bilgilerini döndürür.
    function getNode(uint256 nodeId)
        external
        view
        returns (
            address owner,
            uint8 buildingType,
            uint8 level,
            uint8 attackPower,
            uint8 defensePower,
            uint64 resources
        )
    {
        if (nodeId >= MAX_NODES) revert InvalidNodeId(nodeId);
        Node storage node = nodes[nodeId];
        return (node.owner, node.buildingType, node.level, node.attackPower, node.defensePower, node.resources);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _harvestSingleNode(uint256 nodeId) internal {
        Node storage node = nodes[nodeId];
        if (node.owner == address(0)) return;

        uint256 lastTime = node.lastHarvest;
        if (lastTime == 0 || block.timestamp <= lastTime) return;

        uint256 elapsed = block.timestamp - lastTime;
        uint64 produced = _calculateProduction(node.buildingType, node.level, elapsed);

        if (produced > 0) {
            node.resources += produced;
            playerResources[node.owner] += produced;
        }
    }

    function _calculateProduction(uint8 bType, uint8 lvl, uint256 elapsed) internal pure returns (uint64) {
        if (bType == 1) {
            // Miner
            return uint64(elapsed) * uint64(lvl) * MINER_BASE_RATE;
        } else if (bType == 3) {
            // DataCenter
            return uint64(elapsed) * uint64(lvl) * DATACENTER_BASE_RATE;
        }
        return 0;
    }
}
