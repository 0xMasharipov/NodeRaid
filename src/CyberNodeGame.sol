// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NodeLib} from "./libraries/NodeLib.sol";

/// @title CyberNodeGame — Full Game Logic with Economy & Territory
/// @notice Oyun senaryosu:
///   1. Oyuncu initPlayer() ile 1000 DATA alır ve bir boş node seçip Mainframe kurar
///   2. Mainframe'in bulunduğu subnet'te (128 node) bina kurabilir
///   3. Miner DATA üretir, DataCenter DATA depolar, Firewall savunma sağlar
///   4. Hack 2 aşamalı: önce destroyFirewall() ile FW kır, sonra hack() ile node al
contract CyberNodeGame {
    using NodeLib for bytes32;

    /*//////////////////////////////////////////////////////////////
                              DATA STRUCTURES
    //////////////////////////////////////////////////////////////*/

    struct Subnet {
        bytes32[128] nodes;
    }

    /*//////////////////////////////////////////////////////////////
                               STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    mapping(uint256 => Subnet) internal _subnets;
    mapping(uint256 => uint256) public lastHarvest;
    mapping(address => uint256) public playerResources;
    mapping(address => bool) public playerInitialized;
    mapping(address => uint256) public playerMainframeNode;

    uint256 public constant MAX_NODES = 1024;
    uint256 public constant NODES_PER_SUBNET = 128;
    uint256 public constant TOTAL_SUBNETS = 8;

    // Başlangıç DATA miktarı
    uint256 public constant INITIAL_RESOURCES = 1000;

    // Bina maliyetleri
    uint256 public constant COST_MAINFRAME = 500;
    uint256 public constant COST_MINER = 200;
    uint256 public constant COST_FIREWALL = 300;
    uint256 public constant COST_DATACENTER = 400;

    // Bina tipleri
    uint8 public constant BUILDING_NONE = 0;
    uint8 public constant BUILDING_MINER = 1;
    uint8 public constant BUILDING_FIREWALL = 2;
    uint8 public constant BUILDING_DATACENTER = 3;
    uint8 public constant BUILDING_MAINFRAME = 4;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PlayerInitialized(address indexed player, uint256 mainframeNodeId, uint256 subnetId);
    event NodeHacked(uint256 indexed nodeId, address indexed hacker);
    event NodeBuilt(uint256 indexed nodeId, uint8 buildingType, uint8 level);
    event MassExtracted(uint256 indexed subnetId, address indexed player, uint256 totalResources);
    event NodeUpgraded(uint256 indexed nodeId, uint8 newLevel);
    event FirewallDestroyed(uint256 indexed nodeId, address indexed attacker);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error AlreadyInitialized();
    error NotInitialized();
    error InvalidNodeId(uint256 nodeId);
    error NodeAlreadyOccupied(uint256 nodeId, address currentOwner);
    error NotNodeOwner(uint256 nodeId, address caller);
    error InvalidBuildingType(uint8 buildingType);
    error BuildingAlreadyExists(uint256 nodeId, uint8 currentType);
    error InvalidSubnetId(uint256 subnetId);
    error MaxLevelReached(uint256 nodeId, uint8 currentLevel);
    error HackDefended(uint256 nodeId, uint8 defensePower);
    error InsufficientResources(uint256 required, uint256 available);
    error NotInYourSubnet(uint256 nodeId, uint256 yourSubnet);
    error NotAFirewall(uint256 nodeId, uint8 actualType);
    error CannotHackMainframe(uint256 nodeId);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier validNode(uint256 nodeId) {
        if (nodeId >= MAX_NODES) revert InvalidNodeId(nodeId);
        _;
    }

    modifier validSubnet(uint256 subnetId) {
        if (subnetId >= TOTAL_SUBNETS) revert InvalidSubnetId(subnetId);
        _;
    }

    modifier initialized() {
        if (!playerInitialized[msg.sender]) revert NotInitialized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                        PLAYER INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Oyunu başlat: 1000 DATA al ve bir boş node'a Mainframe kur.
    /// @param nodeId Mainframe kurulacak boş node (0-1023)
    function initPlayer(uint256 nodeId) external validNode(nodeId) {
        if (playerInitialized[msg.sender]) revert AlreadyInitialized();

        uint256 subnetId = nodeId >> 7;
        uint256 offset = nodeId & 0x7F;

        bytes32 packed = _subnets[subnetId].nodes[offset];
        address currentOwner = packed.unpackOwner();

        if (currentOwner != address(0)) revert NodeAlreadyOccupied(nodeId, currentOwner);

        // Oyuncuyu başlat
        playerInitialized[msg.sender] = true;
        playerResources[msg.sender] = INITIAL_RESOURCES - COST_MAINFRAME;
        playerMainframeNode[msg.sender] = nodeId;

        // Mainframe kur (buildingType=4, level=1, defensePower=20)
        bytes32 newPacked = NodeLib.pack(msg.sender, BUILDING_MAINFRAME, 1, 0, 20, 0);
        _subnets[subnetId].nodes[offset] = newPacked;
        lastHarvest[nodeId] = block.timestamp;

        emit PlayerInitialized(msg.sender, nodeId, subnetId);
        emit NodeBuilt(nodeId, BUILDING_MAINFRAME, 1);
    }

    /*//////////////////////////////////////////////////////////////
                        MIP-8 INDEX CALCULATIONS
    //////////////////////////////////////////////////////////////*/

    function getSubnetId(uint256 nodeId) public pure returns (uint256) {
        return nodeId >> 7;
    }

    function getOffset(uint256 nodeId) public pure returns (uint256) {
        return nodeId & 0x7F;
    }

    /*//////////////////////////////////////////////////////////////
                            CORE GAME FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Sahip olduğun subnet'te boş bir node'a bina kur.
    /// @param nodeId Hedef node (0-1023)
    /// @param buildingType 1=Miner, 2=Firewall, 3=DataCenter
    function build(uint256 nodeId, uint8 buildingType) external validNode(nodeId) initialized {
        // Bina tipi kontrolü (Mainframe initPlayer'da kurulur)
        if (buildingType == 0 || buildingType > BUILDING_DATACENTER) {
            revert InvalidBuildingType(buildingType);
        }

        // Subnet kontrolü — sadece kendi subnet'ine kurabilir
        uint256 mySubnet = playerMainframeNode[msg.sender] >> 7;
        uint256 targetSubnet = nodeId >> 7;
        if (targetSubnet != mySubnet) revert NotInYourSubnet(nodeId, mySubnet);

        // Maliyet kontrolü
        uint256 cost = _getBuildCost(buildingType);
        if (playerResources[msg.sender] < cost) {
            revert InsufficientResources(cost, playerResources[msg.sender]);
        }

        uint256 offset = nodeId & 0x7F;
        bytes32 packed = _subnets[targetSubnet].nodes[offset];
        address owner = packed.unpackOwner();

        // Boş node olmalı
        if (owner != address(0)) revert NodeAlreadyOccupied(nodeId, owner);

        // Maliyet düş
        playerResources[msg.sender] -= cost;

        // Bina kur
        uint8 defensePower = 0;
        if (buildingType == BUILDING_FIREWALL) {
            defensePower = 10;
        } else if (buildingType == BUILDING_DATACENTER) {
            defensePower = 5;
        }

        bytes32 newPacked = NodeLib.pack(msg.sender, buildingType, 1, 0, defensePower, 0);
        _subnets[targetSubnet].nodes[offset] = newPacked;
        lastHarvest[nodeId] = block.timestamp;

        emit NodeBuilt(nodeId, buildingType, 1);
    }

    /// @notice Boş ve sahipsiz bir node'u ele geçir (hack).
    /// @dev Firewall'u olan node hacklenemez — önce destroyFirewall çağrılmalı.
    function hack(uint256 nodeId) external validNode(nodeId) initialized {
        uint256 subnetId = nodeId >> 7;
        uint256 offset = nodeId & 0x7F;

        bytes32 packed = _subnets[subnetId].nodes[offset];
        address currentOwner = packed.unpackOwner();

        // Boş node — direkt sahiplen (maliyet yok)
        if (currentOwner == address(0)) {
            bytes32 newPacked = NodeLib.pack(msg.sender, 0, 0, 0, 0, 0);
            _subnets[subnetId].nodes[offset] = newPacked;
            lastHarvest[nodeId] = block.timestamp;
            emit NodeHacked(nodeId, msg.sender);
            return;
        }

        // Kendi node'unu hackleyemez
        if (currentOwner == msg.sender) {
            revert NodeAlreadyOccupied(nodeId, currentOwner);
        }

        // Mainframe hacklenemez
        uint8 bType = packed.unpackBuildingType();
        if (bType == BUILDING_MAINFRAME) {
            revert CannotHackMainframe(nodeId);
        }

        // Firewall kontrolü — defensePower > 0 ise hack başarısız
        uint8 defense = packed.unpackDefensePower();
        if (defense > 0) {
            revert HackDefended(nodeId, defense);
        }

        // Savunmasız node — kaynaklarını eski sahibine ver, sonra ele geçir
        _harvestSingleNode(nodeId, subnetId, offset, packed);

        bytes32 newPacked = NodeLib.pack(msg.sender, 0, 0, 0, 0, 0);
        _subnets[subnetId].nodes[offset] = newPacked;
        lastHarvest[nodeId] = block.timestamp;

        emit NodeHacked(nodeId, msg.sender);
    }

    /// @notice Düşman Firewall'unu yık (Hack aşama 1).
    /// @dev Sadece Firewall tipindeki düşman binalarına uygulanabilir.
    function destroyFirewall(uint256 nodeId) external validNode(nodeId) initialized {
        uint256 subnetId = nodeId >> 7;
        uint256 offset = nodeId & 0x7F;

        bytes32 packed = _subnets[subnetId].nodes[offset];
        address currentOwner = packed.unpackOwner();

        // Kendi binanı yıkamazsın (bunun için ayrı demolish olabilir)
        if (currentOwner == msg.sender) {
            revert NodeAlreadyOccupied(nodeId, currentOwner);
        }

        // Boş node'a saldırılamaz
        if (currentOwner == address(0)) {
            revert InvalidNodeId(nodeId);
        }

        // Sadece Firewall yıkılabilir
        uint8 bType = packed.unpackBuildingType();
        if (bType != BUILDING_FIREWALL) {
            revert NotAFirewall(nodeId, bType);
        }

        // Firewall'u yık — node'u boş bırak (savunmasız hale gelir)
        // Eski sahibin kaynakları korunur
        _harvestSingleNode(nodeId, subnetId, offset, packed);

        // Node'u sıfırla — artık eski sahibin ama savunmasız
        bytes32 newPacked = NodeLib.pack(currentOwner, 0, 0, 0, 0, 0);
        _subnets[subnetId].nodes[offset] = newPacked;
        lastHarvest[nodeId] = block.timestamp;

        emit FirewallDestroyed(nodeId, msg.sender);
    }

    /// @notice Subnet'teki tüm Miner/DataCenter'lardan kaynak topla.
    function massExtract(uint256 subnetId) external validSubnet(subnetId) initialized {
        Subnet storage subnet = _subnets[subnetId];
        uint256 totalProduced;
        uint256 baseNodeId = subnetId << 7;

        for (uint256 i; i < NODES_PER_SUBNET;) {
            bytes32 packed = subnet.nodes[i];

            if (packed.unpackOwner() == msg.sender) {
                uint256 nodeId = baseNodeId + i;
                uint256 lastTime = lastHarvest[nodeId];
                uint256 elapsed;

                if (lastTime > 0 && block.timestamp > lastTime) {
                    elapsed = block.timestamp - lastTime;
                }

                if (elapsed > 0) {
                    uint64 produced = NodeLib.calculateProduction(packed, elapsed);
                    if (produced > 0) {
                        uint64 currentRes = packed.unpackResources();
                        uint64 newRes;
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

    /// @notice Binayı bir seviye yükselt.
    function upgrade(uint256 nodeId) external validNode(nodeId) initialized {
        uint256 subnetId = nodeId >> 7;
        uint256 offset = nodeId & 0x7F;

        bytes32 packed = _subnets[subnetId].nodes[offset];

        if (packed.unpackOwner() != msg.sender) revert NotNodeOwner(nodeId, msg.sender);

        uint8 currentType = packed.unpackBuildingType();
        if (currentType == BUILDING_NONE) revert InvalidBuildingType(0);

        uint8 currentLevel = packed.unpackLevel();
        if (currentLevel >= 10) revert MaxLevelReached(nodeId, currentLevel);

        // Upgrade maliyeti: base cost * current level
        uint256 cost = _getBuildCost(currentType) * uint256(currentLevel);
        if (playerResources[msg.sender] < cost) {
            revert InsufficientResources(cost, playerResources[msg.sender]);
        }
        playerResources[msg.sender] -= cost;

        uint8 newLevel = currentLevel + 1;
        packed = packed.setLevel(newLevel);

        if (currentType == BUILDING_FIREWALL) {
            packed = packed.setDefensePower(10 * newLevel);
        } else if (currentType == BUILDING_DATACENTER) {
            packed = packed.setDefensePower(5 * newLevel);
        }

        _subnets[subnetId].nodes[offset] = packed;

        emit NodeUpgraded(nodeId, newLevel);
    }

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

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
        uint256 subnetId = nodeId >> 7;
        uint256 offset = nodeId & 0x7F;
        bytes32 packed = _subnets[subnetId].nodes[offset];

        owner = packed.unpackOwner();
        buildingType = packed.unpackBuildingType();
        level = packed.unpackLevel();
        attackPower = packed.unpackAttackPower();
        defensePower = packed.unpackDefensePower();
        resources = packed.unpackResources();
    }

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

    /// @notice Oyuncunun oyuna başlayıp başlamadığını döndürür.
    function isPlayerInitialized(address player) external view returns (bool) {
        return playerInitialized[player];
    }

    /// @notice Oyuncunun Mainframe node ID'sini döndürür.
    function getPlayerMainframe(address player) external view returns (uint256) {
        return playerMainframeNode[player];
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _getBuildCost(uint8 buildingType) internal pure returns (uint256) {
        if (buildingType == BUILDING_MINER) return COST_MINER;
        if (buildingType == BUILDING_FIREWALL) return COST_FIREWALL;
        if (buildingType == BUILDING_DATACENTER) return COST_DATACENTER;
        if (buildingType == BUILDING_MAINFRAME) return COST_MAINFRAME;
        return 0;
    }

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
