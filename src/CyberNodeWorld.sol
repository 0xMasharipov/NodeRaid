// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NodeLib} from "./libraries/NodeLib.sol";

/// @title CyberNodeWorld — MIP-8 Optimized On-Chain Strategy Game
/// @author Cyber-Node Team
/// @notice Monad MIP-8 (Page-ified Storage) spesifikasyonuna göre optimize edilmiş
///         on-chain strateji oyunu. Her Subnet tam 1 MIP-8 sayfasına (128 slot = 4096 byte)
///         denk gelir.
/// @dev Storage Architecture:
///
///   ┌─────────────────────────────────────────────────────────────┐
///   │                    WORLD MAP (32×32 = 1024 Nodes)          │
///   │                                                             │
///   │  Subnet 0 (Page 0): Node[0..127]    ← 1 MIP-8 Page        │
///   │  Subnet 1 (Page 1): Node[128..255]  ← 1 MIP-8 Page        │
///   │  Subnet 2 (Page 2): Node[256..383]  ← 1 MIP-8 Page        │
///   │  ...                                                        │
///   │  Subnet 7 (Page 7): Node[896..1023] ← 1 MIP-8 Page        │
///   └─────────────────────────────────────────────────────────────┘
///
///   MIP-8 Gas Advantage (massExtract on 128 nodes):
///     Optimized: 1 cold load (8100) + 127 warm loads (12700) = 20,800 gas
///     Naive:     128 cold loads = 128 × 8100 = 1,036,800 gas
///     Savings:   ~50x
contract CyberNodeWorld {
    using NodeLib for bytes32;

    /*//////////////////////////////////////////////////////////////
                              DATA STRUCTURES
    //////////////////////////////////////////////////////////////*/

    /// @notice Her düğüm tam 1 storage slot (32 byte) kaplar.
    ///         NodeLib ile pack/unpack edilir.
    /// @dev Solidity struct kullanılmaz, doğrudan bytes32 olarak saklanır.
    ///      Bu sayede Solidity'nin ek slot padding'i önlenir.

    /// @notice Bir Subnet = 128 düğüm = tam 1 MIP-8 sayfası (4096 byte).
    /// @dev Fixed-size array kullanılır, böylece tüm node'lar contiguous storage'da kalır.
    struct Subnet {
        bytes32[128] nodes;
    }

    /*//////////////////////////////////////////////////////////////
                               STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Subnet ID → Subnet mapping. 8 Subnet = 1024 düğüm = 32×32 harita.
    mapping(uint256 => Subnet) internal _subnets;

    /// @notice Her düğüm için son kaynak toplama zamanı (block.timestamp).
    /// @dev Ayrı mapping'de tutulur çünkü Node struct'ına sığmaz (zaten 32 byte dolu).
    ///      lastHarvest'lar farklı page'lerde olabilir — bu beklenen bir trade-off.
    mapping(uint256 => uint256) public lastHarvest;

    /// @notice Oyuncuların toplam biriken kaynakları.
    mapping(address => uint256) public playerResources;

    /// @notice Toplam düğüm sayısı üst limiti (32×32).
    uint256 public constant MAX_NODES = 1024;

    /// @notice Bir Subnet'teki düğüm sayısı (MIP-8 page = 128 slot).
    uint256 public constant NODES_PER_SUBNET = 128;

    /// @notice Toplam Subnet sayısı.
    uint256 public constant TOTAL_SUBNETS = 8;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Bir düğüm hack (ele geçirme) edildiğinde tetiklenir.
    event NodeHacked(uint256 indexed nodeId, address indexed hacker);

    /// @notice Bir düğüm üzerine bina kurulduğunda tetiklenir.
    event NodeBuilt(uint256 indexed nodeId, uint8 buildingType, uint8 level);

    /// @notice Bir Subnet'ten toplu kaynak toplandığında tetiklenir.
    event MassExtracted(uint256 indexed subnetId, address indexed player, uint256 totalResources);

    /// @notice Bina yükseltme yapıldığında tetiklenir.
    event NodeUpgraded(uint256 indexed nodeId, uint8 newLevel);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice nodeId geçerli aralıkta değil.
    error InvalidNodeId(uint256 nodeId);

    /// @notice Düğüm zaten başka bir oyuncuya ait.
    error NodeAlreadyOccupied(uint256 nodeId, address currentOwner);

    /// @notice Çağıran, düğümün sahibi değil.
    error NotNodeOwner(uint256 nodeId, address caller);

    /// @notice Geçersiz bina tipi.
    error InvalidBuildingType(uint8 buildingType);

    /// @notice Düğümde zaten bina var.
    error BuildingAlreadyExists(uint256 nodeId, uint8 currentType);

    /// @notice subnetId geçerli aralıkta değil.
    error InvalidSubnetId(uint256 subnetId);

    /// @notice Bina zaten maksimum seviyede.
    error MaxLevelReached(uint256 nodeId, uint8 currentLevel);

    /// @notice Hack savunması başarılı — Firewall engelledi.
    error HackDefended(uint256 nodeId, uint8 defensePower);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @dev nodeId'nin geçerli olduğunu doğrular.
    modifier validNode(uint256 nodeId) {
        if (nodeId >= MAX_NODES) revert InvalidNodeId(nodeId);
        _;
    }

    /// @dev subnetId'nin geçerli olduğunu doğrular.
    modifier validSubnet(uint256 subnetId) {
        if (subnetId >= TOTAL_SUBNETS) revert InvalidSubnetId(subnetId);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                        MIP-8 INDEX CALCULATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice nodeId'den subnetId (page_index) hesaplar.
    /// @dev MIP-8: page_index(slot) = slot >> 7
    /// @param nodeId Düğüm ID'si (0-1023)
    /// @return subnetId Subnet indeksi (0-7)
    function getSubnetId(uint256 nodeId) public pure returns (uint256 subnetId) {
        assembly {
            subnetId := shr(7, nodeId)
        }
    }

    /// @notice nodeId'den sayfa içi offset hesaplar.
    /// @dev MIP-8: offset(slot) = slot & 0x7F
    /// @param nodeId Düğüm ID'si (0-1023)
    /// @return offset Sayfa içi konum (0-127)
    function getOffset(uint256 nodeId) public pure returns (uint256 offset) {
        assembly {
            offset := and(nodeId, 0x7F)
        }
    }

    /*//////////////////////////////////////////////////////////////
                            CORE GAME FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Boş bir düğümü ele geçir (hack).
    /// @dev Düğüm boşsa → msg.sender sahip olur.
    ///      Düğümde Firewall varsa → defensePower kadar engel uygulanır.
    ///      Gas: 1 cold page load + 1 warm write = ~11,000 gas (MIP-8).
    /// @param nodeId Hedef düğümün ID'si (0-1023)
    function hack(uint256 nodeId) external validNode(nodeId) {
        uint256 subnetId = getSubnetId(nodeId);
        uint256 offset = getOffset(nodeId);

        bytes32 packed = _subnets[subnetId].nodes[offset];
        address currentOwner = packed.unpackOwner();

        // Düğüm boş — direkt ele geçir
        if (currentOwner == address(0)) {
            bytes32 newPacked = NodeLib.pack(msg.sender, 0, 0, 0, 0, 0);
            _subnets[subnetId].nodes[offset] = newPacked;
            lastHarvest[nodeId] = block.timestamp;

            emit NodeHacked(nodeId, msg.sender);
            return;
        }

        // Düğüm dolu — kendi düğümünü tekrar hack edemez
        if (currentOwner == msg.sender) {
            revert NodeAlreadyOccupied(nodeId, currentOwner);
        }

        // Firewall kontrolü — defensePower > 0 ise hack başarısız
        uint8 defense = packed.unpackDefensePower();
        if (defense > 0) {
            revert HackDefended(nodeId, defense);
        }

        // Savunmasız düğüm — ele geçir, binaları sıfırla
        _harvestSingleNode(nodeId, subnetId, offset, packed);

        bytes32 newPacked = NodeLib.pack(msg.sender, 0, 0, 0, 0, 0);
        _subnets[subnetId].nodes[offset] = newPacked;
        lastHarvest[nodeId] = block.timestamp;

        emit NodeHacked(nodeId, msg.sender);
    }

    /// @notice Sahip olduğun düğüm üzerine bina kur.
    /// @dev buildingType: 1=Miner, 2=Firewall, 3=DataCenter
    ///      Bina kurulduğunda level=1, ilgili stat'lar ayarlanır.
    ///      Gas: Warm read + warm write (aynı page) = ~200 gas (MIP-8).
    /// @param nodeId Hedef düğümün ID'si (0-1023)
    /// @param buildingType Kurulacak bina tipi
    function build(uint256 nodeId, uint8 buildingType) external validNode(nodeId) {
        // Geçerli bina tipi kontrolü (1, 2, 3)
        if (buildingType == 0 || buildingType > NodeLib.BUILDING_DATACENTER) {
            revert InvalidBuildingType(buildingType);
        }

        uint256 subnetId = getSubnetId(nodeId);
        uint256 offset = getOffset(nodeId);

        bytes32 packed = _subnets[subnetId].nodes[offset];
        address owner = packed.unpackOwner();

        // Sahiplik kontrolü
        if (owner != msg.sender) revert NotNodeOwner(nodeId, msg.sender);

        // Mevcut bina kontrolü
        uint8 currentType = packed.unpackBuildingType();
        if (currentType != NodeLib.BUILDING_NONE) {
            revert BuildingAlreadyExists(nodeId, currentType);
        }

        // Bina kur: level=1, ilgili stat'ları ayarla
        packed = packed.setBuildingType(buildingType);
        packed = packed.setLevel(1);

        if (buildingType == NodeLib.BUILDING_FIREWALL) {
            // Firewall: defensePower = 10 (başlangıç)
            packed = packed.setDefensePower(10);
        } else if (buildingType == NodeLib.BUILDING_MINER) {
            // Miner: attackPower = 0, defensePower = 0
            packed = packed.setAttackPower(0);
        } else if (buildingType == NodeLib.BUILDING_DATACENTER) {
            // DataCenter: defensePower = 5 (hafif savunma)
            packed = packed.setDefensePower(5);
        }

        _subnets[subnetId].nodes[offset] = packed;
        lastHarvest[nodeId] = block.timestamp;

        emit NodeBuilt(nodeId, buildingType, 1);
    }

    /// @notice Bir Subnet içindeki tüm oyuncu düğümlerinden kaynak topla (Mass Extract).
    /// @dev MIP-8'in ana avantajı burada ortaya çıkar:
    ///      İlk SLOAD cold page load (8100 gas), sonraki 127 SLOAD warm read (127×100 gas).
    ///      Toplam: ~20,800 gas vs naive yaklaşımda ~1,036,800 gas.
    ///
    ///      Döngü, 128 node'u sırayla okur. Sadece msg.sender'a ait Miner/DataCenter
    ///      düğümlerinden kaynak üretimi hesaplanır.
    /// @param subnetId Subnet indeksi (0-7)
    function massExtract(uint256 subnetId) external validSubnet(subnetId) {
        Subnet storage subnet = _subnets[subnetId];
        uint256 totalProduced;
        uint256 baseNodeId = subnetId << 7; // subnetId * 128

        // MIP-8 Avantajı: İlk SLOAD cold page yükler,
        // kalan 127 SLOAD aynı page'den warm read yapar.
        for (uint256 i; i < NODES_PER_SUBNET;) {
            bytes32 packed = subnet.nodes[i];

            // Sadece msg.sender'a ait düğümler
            if (packed.unpackOwner() == msg.sender) {
                uint256 nodeId = baseNodeId + i;
                uint256 lastTime = lastHarvest[nodeId];
                uint256 elapsed;

                // İlk kez toplama yapılıyorsa elapsed = 0
                if (lastTime > 0 && block.timestamp > lastTime) {
                    elapsed = block.timestamp - lastTime;
                }

                if (elapsed > 0) {
                    uint64 produced = NodeLib.calculateProduction(packed, elapsed);
                    if (produced > 0) {
                        // Mevcut resources'a ekle
                        uint64 currentRes = packed.unpackResources();
                        uint64 newRes;

                        // Overflow koruması
                        unchecked {
                            newRes = currentRes + produced;
                            if (newRes < currentRes) newRes = type(uint64).max;
                        }

                        packed = packed.setResources(newRes);
                        subnet.nodes[i] = packed;

                        totalProduced += produced;
                    }
                }

                lastHarvest[nodeId] = block.timestamp;
            }

            unchecked { ++i; }
        }

        if (totalProduced > 0) {
            playerResources[msg.sender] += totalProduced;
        }

        emit MassExtracted(subnetId, msg.sender, totalProduced);
    }

    /// @notice Mevcut binayı bir seviye yükselt.
    /// @dev Maksimum seviye: 10. Her seviye yükseltme stat'ları artırır.
    /// @param nodeId Hedef düğümün ID'si (0-1023)
    function upgrade(uint256 nodeId) external validNode(nodeId) {
        uint256 subnetId = getSubnetId(nodeId);
        uint256 offset = getOffset(nodeId);

        bytes32 packed = _subnets[subnetId].nodes[offset];

        if (packed.unpackOwner() != msg.sender) revert NotNodeOwner(nodeId, msg.sender);

        uint8 currentType = packed.unpackBuildingType();
        if (currentType == NodeLib.BUILDING_NONE) revert InvalidBuildingType(0);

        uint8 currentLevel = packed.unpackLevel();
        if (currentLevel >= 10) revert MaxLevelReached(nodeId, currentLevel);

        uint8 newLevel = currentLevel + 1;
        packed = packed.setLevel(newLevel);

        // Bina tipine göre stat yükseltme
        if (currentType == NodeLib.BUILDING_FIREWALL) {
            packed = packed.setDefensePower(10 * newLevel);
        } else if (currentType == NodeLib.BUILDING_DATACENTER) {
            packed = packed.setDefensePower(5 * newLevel);
        }

        _subnets[subnetId].nodes[offset] = packed;

        emit NodeUpgraded(nodeId, newLevel);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Belirli bir düğümün bilgilerini döndürür.
    /// @param nodeId Düğüm ID'si (0-1023)
    /// @return owner Sahip adresi
    /// @return buildingType Bina tipi
    /// @return level Bina seviyesi
    /// @return attackPower Saldırı gücü
    /// @return defensePower Savunma gücü
    /// @return resources Biriken kaynak
    function getNode(uint256 nodeId)
        external
        view
        validNode(nodeId)
        returns (
            address owner,
            uint8 buildingType,
            uint8 level,
            uint8 attackPower,
            uint8 defensePower,
            uint64 resources
        )
    {
        uint256 subnetId = getSubnetId(nodeId);
        uint256 offset = getOffset(nodeId);

        bytes32 packed = _subnets[subnetId].nodes[offset];

        owner = packed.unpackOwner();
        buildingType = packed.unpackBuildingType();
        level = packed.unpackLevel();
        attackPower = packed.unpackAttackPower();
        defensePower = packed.unpackDefensePower();
        resources = packed.unpackResources();
    }

    /// @notice Bir Subnet'teki tüm düğümlerin raw packed verisini döndürür.
    /// @dev Gas-efficient toplu okuma — off-chain indexer'lar için.
    /// @param subnetId Subnet indeksi (0-7)
    /// @return nodes 128 elemanlı bytes32 dizisi
    function getSubnetData(uint256 subnetId)
        external
        view
        validSubnet(subnetId)
        returns (bytes32[128] memory nodes)
    {
        Subnet storage subnet = _subnets[subnetId];
        for (uint256 i; i < NODES_PER_SUBNET;) {
            nodes[i] = subnet.nodes[i];
            unchecked { ++i; }
        }
    }

    /// @notice Bir Subnet'te belirli bir oyuncunun kaç düğümü olduğunu sayar.
    /// @param subnetId Subnet indeksi (0-7)
    /// @param player Oyuncu adresi
    /// @return count Oyuncunun düğüm sayısı
    function countPlayerNodes(uint256 subnetId, address player)
        external
        view
        validSubnet(subnetId)
        returns (uint256 count)
    {
        Subnet storage subnet = _subnets[subnetId];
        for (uint256 i; i < NODES_PER_SUBNET;) {
            if (subnet.nodes[i].unpackOwner() == player) {
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Tek bir düğümün birikmiş kaynağını toplar ve sahibine aktarır.
    ///      Düğüm el değiştirmeden önce çağrılır.
    function _harvestSingleNode(
        uint256 nodeId,
        uint256 subnetId,
        uint256 offset,
        bytes32 packed
    ) internal {
        address owner = packed.unpackOwner();
        if (owner == address(0)) return;

        uint256 lastTime = lastHarvest[nodeId];
        if (lastTime == 0 || block.timestamp <= lastTime) return;

        uint256 elapsed = block.timestamp - lastTime;
        uint64 produced = NodeLib.calculateProduction(packed, elapsed);

        if (produced > 0) {
            uint64 currentRes = packed.unpackResources();
            uint64 newRes;
            unchecked {
                newRes = currentRes + produced;
                if (newRes < currentRes) newRes = type(uint64).max;
            }
            packed = packed.setResources(newRes);
            _subnets[subnetId].nodes[offset] = packed;
            playerResources[owner] += produced;
        }
    }
}
