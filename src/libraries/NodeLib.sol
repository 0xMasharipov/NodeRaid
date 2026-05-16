// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title NodeLib — Bit-Packed Node Operations for Cyber-Node
/// @author Cyber-Node Team
/// @notice MIP-8 uyumlu, 32-byte'a sıkıştırılmış Node verisi üzerinde
///         bitwise pack/unpack işlemleri sağlar.
/// @dev Storage Layout (32 bytes = 1 EVM slot):
///
///   Bit Range   | Field         | Type    | Size
///   ------------|---------------|---------|--------
///   [0:159]     | owner         | address | 20 bytes
///   [160:167]   | buildingType  | uint8   | 1 byte
///   [168:175]   | level         | uint8   | 1 byte
///   [176:183]   | attackPower   | uint8   | 1 byte
///   [184:191]   | defensePower  | uint8   | 1 byte
///   [192:255]   | resources     | uint64  | 8 bytes
///
///   Total: 20 + 1 + 1 + 1 + 1 + 8 = 32 bytes ✓
library NodeLib {
    /*//////////////////////////////////////////////////////////////
                            BIT MASKS & SHIFTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Owner alanı: alt 160 bit
    uint256 internal constant OWNER_MASK = (1 << 160) - 1;

    /// @dev BuildingType alanı: bit [160:167]
    uint256 internal constant BUILDING_TYPE_SHIFT = 160;
    uint256 internal constant BUILDING_TYPE_MASK = uint256(0xFF) << BUILDING_TYPE_SHIFT;

    /// @dev Level alanı: bit [168:175]
    uint256 internal constant LEVEL_SHIFT = 168;
    uint256 internal constant LEVEL_MASK = uint256(0xFF) << LEVEL_SHIFT;

    /// @dev AttackPower alanı: bit [176:183]
    uint256 internal constant ATTACK_SHIFT = 176;
    uint256 internal constant ATTACK_MASK = uint256(0xFF) << ATTACK_SHIFT;

    /// @dev DefensePower alanı: bit [184:191]
    uint256 internal constant DEFENSE_SHIFT = 184;
    uint256 internal constant DEFENSE_MASK = uint256(0xFF) << DEFENSE_SHIFT;

    /// @dev Resources alanı: bit [192:255]
    uint256 internal constant RESOURCES_SHIFT = 192;
    uint256 internal constant RESOURCES_MASK = uint256(0xFFFFFFFFFFFFFFFF) << RESOURCES_SHIFT;

    /*//////////////////////////////////////////////////////////////
                            BUILDING TYPES
    //////////////////////////////////////////////////////////////*/

    /// @notice Bina tipi yok (boş düğüm, sahiplenilmiş ama bina kurulmamış)
    uint8 internal constant BUILDING_NONE = 0;

    /// @notice Miner: Temel kaynak üretir
    uint8 internal constant BUILDING_MINER = 1;

    /// @notice Firewall: Düğümün hack edilmesini zorlaştırır (savunma)
    uint8 internal constant BUILDING_FIREWALL = 2;

    /// @notice DataCenter: Gelişmiş veri depolama ve işleme
    uint8 internal constant BUILDING_DATACENTER = 3;

    /*//////////////////////////////////////////////////////////////
                          KAYNAK ÜRETİM ORANLARI
    //////////////////////////////////////////////////////////////*/

    /// @notice Miner bina tipi için seviye başına kaynak üretim oranı (birim/saniye)
    uint64 internal constant MINER_BASE_RATE = 10;

    /// @notice DataCenter bina tipi için seviye başına kaynak üretim oranı (birim/saniye)
    uint64 internal constant DATACENTER_BASE_RATE = 25;

    /*//////////////////////////////////////////////////////////////
                              PACK FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Tüm alanları tek bir bytes32 (uint256) değerine pack eder.
    /// @param owner Düğüm sahibinin adresi
    /// @param buildingType Bina tipi (0=Yok, 1=Miner, 2=Firewall, 3=DataCenter)
    /// @param level Bina seviyesi (0-255)
    /// @param attackPower Saldırı gücü (0-255)
    /// @param defensePower Savunma gücü (0-255)
    /// @param resources Biriken kaynak miktarı
    /// @return packed 32-byte packed değer
    function pack(
        address owner,
        uint8 buildingType,
        uint8 level,
        uint8 attackPower,
        uint8 defensePower,
        uint64 resources
    ) internal pure returns (bytes32 packed) {
        /// @solidity memory-safe-assembly
        assembly {
            packed := or(
                or(
                    or(
                        and(owner, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF),
                        shl(160, and(buildingType, 0xFF))
                    ),
                    or(
                        shl(168, and(level, 0xFF)),
                        shl(176, and(attackPower, 0xFF))
                    )
                ),
                or(
                    shl(184, and(defensePower, 0xFF)),
                    shl(192, and(resources, 0xFFFFFFFFFFFFFFFF))
                )
            )
        }
    }

    /*//////////////////////////////////////////////////////////////
                             UNPACK FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Packed değerden owner adresini çıkarır.
    /// @param packed 32-byte packed node verisi
    /// @return owner Düğüm sahibinin adresi
    function unpackOwner(bytes32 packed) internal pure returns (address owner) {
        assembly {
            owner := and(packed, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        }
    }

    /// @notice Packed değerden buildingType'ı çıkarır.
    /// @param packed 32-byte packed node verisi
    /// @return buildingType Bina tipi
    function unpackBuildingType(bytes32 packed) internal pure returns (uint8 buildingType) {
        assembly {
            buildingType := and(shr(160, packed), 0xFF)
        }
    }

    /// @notice Packed değerden level'ı çıkarır.
    /// @param packed 32-byte packed node verisi
    /// @return level Bina seviyesi
    function unpackLevel(bytes32 packed) internal pure returns (uint8 level) {
        assembly {
            level := and(shr(168, packed), 0xFF)
        }
    }

    /// @notice Packed değerden attackPower'ı çıkarır.
    /// @param packed 32-byte packed node verisi
    /// @return attackPower Saldırı gücü
    function unpackAttackPower(bytes32 packed) internal pure returns (uint8 attackPower) {
        assembly {
            attackPower := and(shr(176, packed), 0xFF)
        }
    }

    /// @notice Packed değerden defensePower'ı çıkarır.
    /// @param packed 32-byte packed node verisi
    /// @return defensePower Savunma gücü
    function unpackDefensePower(bytes32 packed) internal pure returns (uint8 defensePower) {
        assembly {
            defensePower := and(shr(184, packed), 0xFF)
        }
    }

    /// @notice Packed değerden resources'ı çıkarır.
    /// @param packed 32-byte packed node verisi
    /// @return resources Kaynak miktarı
    function unpackResources(bytes32 packed) internal pure returns (uint64 resources) {
        assembly {
            resources := and(shr(192, packed), 0xFFFFFFFFFFFFFFFF)
        }
    }

    /*//////////////////////////////////////////////////////////////
                           FIELD UPDATE HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mevcut packed değerde owner'ı günceller.
    /// @param packed Mevcut packed node verisi
    /// @param newOwner Yeni sahip adresi
    /// @return updated Güncellenmiş packed değer
    function setOwner(bytes32 packed, address newOwner) internal pure returns (bytes32 updated) {
        assembly {
            // Eski owner'ı temizle, yeni owner'ı ekle
            updated := or(
                and(packed, not(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)),
                and(newOwner, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            )
        }
    }

    /// @notice Mevcut packed değerde buildingType'ı günceller.
    /// @param packed Mevcut packed node verisi
    /// @param newType Yeni bina tipi
    /// @return updated Güncellenmiş packed değer
    function setBuildingType(bytes32 packed, uint8 newType) internal pure returns (bytes32 updated) {
        assembly {
            updated := or(
                and(packed, not(shl(160, 0xFF))),
                shl(160, and(newType, 0xFF))
            )
        }
    }

    /// @notice Mevcut packed değerde level'ı günceller.
    /// @param packed Mevcut packed node verisi
    /// @param newLevel Yeni seviye
    /// @return updated Güncellenmiş packed değer
    function setLevel(bytes32 packed, uint8 newLevel) internal pure returns (bytes32 updated) {
        assembly {
            updated := or(
                and(packed, not(shl(168, 0xFF))),
                shl(168, and(newLevel, 0xFF))
            )
        }
    }

    /// @notice Mevcut packed değerde resources'ı günceller.
    /// @param packed Mevcut packed node verisi
    /// @param newResources Yeni kaynak miktarı
    /// @return updated Güncellenmiş packed değer
    function setResources(bytes32 packed, uint64 newResources) internal pure returns (bytes32 updated) {
        assembly {
            updated := or(
                and(packed, not(shl(192, 0xFFFFFFFFFFFFFFFF))),
                shl(192, and(newResources, 0xFFFFFFFFFFFFFFFF))
            )
        }
    }

    /// @notice Mevcut packed değerde defensePower'ı günceller.
    /// @param packed Mevcut packed node verisi
    /// @param newDefense Yeni savunma gücü
    /// @return updated Güncellenmiş packed değer
    function setDefensePower(bytes32 packed, uint8 newDefense) internal pure returns (bytes32 updated) {
        assembly {
            updated := or(
                and(packed, not(shl(184, 0xFF))),
                shl(184, and(newDefense, 0xFF))
            )
        }
    }

    /// @notice Mevcut packed değerde attackPower'ı günceller.
    /// @param packed Mevcut packed node verisi
    /// @param newAttack Yeni saldırı gücü
    /// @return updated Güncellenmiş packed değer
    function setAttackPower(bytes32 packed, uint8 newAttack) internal pure returns (bytes32 updated) {
        assembly {
            updated := or(
                and(packed, not(shl(176, 0xFF))),
                shl(176, and(newAttack, 0xFF))
            )
        }
    }

    /*//////////////////////////////////////////////////////////////
                         KAYNAK HESAPLAMA
    //////////////////////////////////////////////////////////////*/

    /// @notice Bir düğümün belirli bir zaman aralığında ürettiği kaynağı hesaplar.
    /// @param packed 32-byte packed node verisi
    /// @param elapsed Geçen süre (saniye)
    /// @return produced Üretilen kaynak miktarı
    function calculateProduction(bytes32 packed, uint256 elapsed) internal pure returns (uint64 produced) {
        uint8 bType = unpackBuildingType(packed);
        uint8 lvl = unpackLevel(packed);

        if (bType == BUILDING_MINER) {
            produced = uint64(elapsed) * uint64(lvl) * MINER_BASE_RATE;
        } else if (bType == BUILDING_DATACENTER) {
            produced = uint64(elapsed) * uint64(lvl) * DATACENTER_BASE_RATE;
        }
        // Firewall ve NONE bina tipleri kaynak üretmez → produced = 0
    }
}
