// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {CyberNodeWorld} from "../src/CyberNodeWorld.sol";
import {NodeLib} from "../src/libraries/NodeLib.sol";

/// @title CyberNodeWorld Functional Tests
/// @notice CyberNodeWorld kontratının tüm fonksiyonlarını doğrulayan test suite.
contract CyberNodeWorldTest is Test {
    CyberNodeWorld public world;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    function setUp() public {
        world = new CyberNodeWorld();
    }

    /*//////////////////////////////////////////////////////////////
                         MIP-8 INDEX MATH TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice subnetId hesaplamasını doğrular (nodeId >> 7).
    function test_getSubnetId() public view {
        assertEq(world.getSubnetId(0), 0, "Node 0 -> Subnet 0");
        assertEq(world.getSubnetId(127), 0, "Node 127 -> Subnet 0");
        assertEq(world.getSubnetId(128), 1, "Node 128 -> Subnet 1");
        assertEq(world.getSubnetId(255), 1, "Node 255 -> Subnet 1");
        assertEq(world.getSubnetId(256), 2, "Node 256 -> Subnet 2");
        assertEq(world.getSubnetId(1023), 7, "Node 1023 -> Subnet 7");
    }

    /// @notice Offset hesaplamasını doğrular (nodeId & 0x7F).
    function test_getOffset() public view {
        assertEq(world.getOffset(0), 0, "Node 0 -> Offset 0");
        assertEq(world.getOffset(127), 127, "Node 127 -> Offset 127");
        assertEq(world.getOffset(128), 0, "Node 128 -> Offset 0");
        assertEq(world.getOffset(129), 1, "Node 129 -> Offset 1");
        assertEq(world.getOffset(1023), 127, "Node 1023 -> Offset 127");
    }

    /*//////////////////////////////////////////////////////////////
                            HACK FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Boş düğümü başarıyla ele geçirme.
    function test_hack_emptyNode() public {
        vm.prank(alice);
        world.hack(0);

        (address owner,,,,, ) = world.getNode(0);
        assertEq(owner, alice, "Alice should own node 0");
    }

    /// @notice Boş düğüm hack'lendiğinde event emit edilmeli.
    function test_hack_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit CyberNodeWorld.NodeHacked(0, alice);

        vm.prank(alice);
        world.hack(0);
    }

    /// @notice Kendi düğümünü tekrar hack etme denemesi — revert beklenir.
    function test_hack_revertIfOwnNode() public {
        vm.prank(alice);
        world.hack(0);

        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.NodeAlreadyOccupied.selector, 0, alice)
        );
        vm.prank(alice);
        world.hack(0);
    }

    /// @notice Firewall'lu düğümü hack etme denemesi — revert beklenir.
    function test_hack_revertIfFirewalled() public {
        // Alice düğümü ele geçir ve Firewall kur
        vm.startPrank(alice);
        world.hack(5);
        world.build(5, NodeLib.BUILDING_FIREWALL);
        vm.stopPrank();

        // Bob hack'lemeyi dener — defensePower > 0 → revert
        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.HackDefended.selector, 5, 10)
        );
        vm.prank(bob);
        world.hack(5);
    }

    /// @notice Savunmasız düğümü başka oyuncu hack edebilmeli.
    function test_hack_undefendedNode() public {
        // Alice düğümü ele geçir (bina kurmadan)
        vm.prank(alice);
        world.hack(10);

        // Bob savunmasız düğümü hack eder
        vm.prank(bob);
        world.hack(10);

        (address owner,,,,, ) = world.getNode(10);
        assertEq(owner, bob, "Bob should now own node 10");
    }

    /// @notice Geçersiz nodeId ile hack — revert beklenir.
    function test_hack_revertInvalidNodeId() public {
        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.InvalidNodeId.selector, 1024)
        );
        vm.prank(alice);
        world.hack(1024);
    }

    /*//////////////////////////////////////////////////////////////
                           BUILD FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Sahip olunan düğüme Miner bina kurma.
    function test_build_miner() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_MINER);
        vm.stopPrank();

        (, uint8 buildingType, uint8 level,,, ) = world.getNode(0);
        assertEq(buildingType, NodeLib.BUILDING_MINER, "Should be Miner");
        assertEq(level, 1, "Level should be 1");
    }

    /// @notice Sahip olunan düğüme Firewall bina kurma.
    function test_build_firewall() public {
        vm.startPrank(alice);
        world.hack(1);
        world.build(1, NodeLib.BUILDING_FIREWALL);
        vm.stopPrank();

        (, uint8 buildingType, uint8 level,, uint8 defensePower, ) = world.getNode(1);
        assertEq(buildingType, NodeLib.BUILDING_FIREWALL, "Should be Firewall");
        assertEq(level, 1, "Level should be 1");
        assertEq(defensePower, 10, "Defense should be 10");
    }

    /// @notice Sahip olunan düğüme DataCenter bina kurma.
    function test_build_dataCenter() public {
        vm.startPrank(alice);
        world.hack(2);
        world.build(2, NodeLib.BUILDING_DATACENTER);
        vm.stopPrank();

        (, uint8 buildingType, uint8 level,, uint8 defensePower, ) = world.getNode(2);
        assertEq(buildingType, NodeLib.BUILDING_DATACENTER, "Should be DataCenter");
        assertEq(level, 1, "Level should be 1");
        assertEq(defensePower, 5, "Defense should be 5");
    }

    /// @notice Başkasının düğümüne bina kurma — revert beklenir.
    function test_build_revertIfNotOwner() public {
        vm.prank(alice);
        world.hack(0);

        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.NotNodeOwner.selector, 0, bob)
        );
        vm.prank(bob);
        world.build(0, NodeLib.BUILDING_MINER);
    }

    /// @notice Zaten bina olan düğüme tekrar bina kurma — revert beklenir.
    function test_build_revertIfBuildingExists() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_MINER);

        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.BuildingAlreadyExists.selector, 0, NodeLib.BUILDING_MINER)
        );
        world.build(0, NodeLib.BUILDING_FIREWALL);
        vm.stopPrank();
    }

    /// @notice Geçersiz bina tipi ile bina kurma — revert beklenir.
    function test_build_revertInvalidType() public {
        vm.startPrank(alice);
        world.hack(0);

        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.InvalidBuildingType.selector, 0)
        );
        world.build(0, 0);

        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.InvalidBuildingType.selector, 4)
        );
        world.build(0, 4);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                       MASS EXTRACT FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice massExtract ile kaynak toplama doğruluğu.
    function test_massExtract_collectResources() public {
        // Alice: 3 Miner düğüm kur (nodeId 0, 1, 2 — aynı Subnet)
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_MINER);
        world.hack(1);
        world.build(1, NodeLib.BUILDING_MINER);
        world.hack(2);
        world.build(2, NodeLib.BUILDING_MINER);
        vm.stopPrank();

        // 100 saniye ilerlet
        vm.warp(block.timestamp + 100);

        // Alice Subnet 0'dan kaynak toplar
        vm.prank(alice);
        world.massExtract(0);

        // Her Miner: level=1, 100 saniye × 1 × 10 = 1000 kaynak
        // 3 Miner → 3000 toplam
        uint256 totalResources = world.playerResources(alice);
        assertEq(totalResources, 3000, "Should collect 3000 resources from 3 miners");
    }

    /// @notice massExtract sadece çağıranın düğümlerinden toplar.
    function test_massExtract_onlyOwnerNodes() public {
        // Alice ve Bob aynı Subnet'te düğüm kursun
        vm.prank(alice);
        world.hack(0);
        vm.prank(alice);
        world.build(0, NodeLib.BUILDING_MINER);

        vm.prank(bob);
        world.hack(1);
        vm.prank(bob);
        world.build(1, NodeLib.BUILDING_MINER);

        vm.warp(block.timestamp + 100);

        // Alice sadece kendi düğümünden toplar
        vm.prank(alice);
        world.massExtract(0);

        assertEq(world.playerResources(alice), 1000, "Alice should get 1000");
        assertEq(world.playerResources(bob), 0, "Bob should get 0 (hasn't extracted)");
    }

    /// @notice Firewall düğümleri kaynak üretmez.
    function test_massExtract_firewallNoResources() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_FIREWALL);
        vm.stopPrank();

        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        world.massExtract(0);

        assertEq(world.playerResources(alice), 0, "Firewall should produce 0 resources");
    }

    /// @notice DataCenter düğümleri daha yüksek kaynak üretir.
    function test_massExtract_dataCenterHigherRate() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_DATACENTER);
        vm.stopPrank();

        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        world.massExtract(0);

        // DataCenter: level=1, 100 saniye × 1 × 25 = 2500 kaynak
        assertEq(world.playerResources(alice), 2500, "DataCenter should produce 2500 resources");
    }

    /// @notice Geçersiz subnetId ile massExtract — revert beklenir.
    function test_massExtract_revertInvalidSubnet() public {
        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.InvalidSubnetId.selector, 8)
        );
        vm.prank(alice);
        world.massExtract(8);
    }

    /*//////////////////////////////////////////////////////////////
                          UPGRADE FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Bina yükseltme doğruluğu.
    function test_upgrade() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_MINER);

        world.upgrade(0);
        vm.stopPrank();

        (,, uint8 level,,, ) = world.getNode(0);
        assertEq(level, 2, "Level should be 2 after upgrade");
    }

    /// @notice Firewall yükseltmesi defensePower'ı artırır.
    function test_upgrade_firewallDefense() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_FIREWALL);

        world.upgrade(0); // level 2
        world.upgrade(0); // level 3
        vm.stopPrank();

        (,, uint8 level,, uint8 defensePower, ) = world.getNode(0);
        assertEq(level, 3, "Level should be 3");
        assertEq(defensePower, 30, "Defense should be 30 at level 3");
    }

    /// @notice Maksimum seviye aşılması — revert beklenir.
    function test_upgrade_revertMaxLevel() public {
        vm.startPrank(alice);
        world.hack(0);
        world.build(0, NodeLib.BUILDING_MINER);

        // 9 kez yükselt (level 1→10)
        for (uint256 i; i < 9; i++) {
            world.upgrade(0);
        }

        (,, uint8 level,,, ) = world.getNode(0);
        assertEq(level, 10, "Should be max level");

        vm.expectRevert(
            abi.encodeWithSelector(CyberNodeWorld.MaxLevelReached.selector, 0, 10)
        );
        world.upgrade(0);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                       VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice getSubnetData toplu veri okuma.
    function test_getSubnetData() public {
        vm.prank(alice);
        world.hack(0);

        bytes32[128] memory data = world.getSubnetData(0);

        // İlk node alice'e ait olmalı
        address owner = NodeLib.unpackOwner(data[0]);
        assertEq(owner, alice, "First node should be alice");

        // Diğer node'lar boş
        address emptyOwner = NodeLib.unpackOwner(data[1]);
        assertEq(emptyOwner, address(0), "Second node should be empty");
    }

    /// @notice countPlayerNodes oyuncu düğüm sayısı.
    function test_countPlayerNodes() public {
        vm.startPrank(alice);
        world.hack(0);
        world.hack(5);
        world.hack(10);
        vm.stopPrank();

        vm.prank(bob);
        world.hack(1);

        uint256 aliceCount = world.countPlayerNodes(0, alice);
        uint256 bobCount = world.countPlayerNodes(0, bob);

        assertEq(aliceCount, 3, "Alice should have 3 nodes");
        assertEq(bobCount, 1, "Bob should have 1 node");
    }

    /*//////////////////////////////////////////////////////////////
                       NODE PACKING TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice NodeLib pack/unpack round-trip doğruluğu.
    function test_nodeLib_packUnpack() public pure {
        address testOwner = address(0xdead);
        uint8 bType = 2;
        uint8 level = 5;
        uint8 attack = 100;
        uint8 defense = 200;
        uint64 resources = 123456789;

        bytes32 packed = NodeLib.pack(testOwner, bType, level, attack, defense, resources);

        assertEq(NodeLib.unpackOwner(packed), testOwner, "Owner mismatch");
        assertEq(NodeLib.unpackBuildingType(packed), bType, "BuildingType mismatch");
        assertEq(NodeLib.unpackLevel(packed), level, "Level mismatch");
        assertEq(NodeLib.unpackAttackPower(packed), attack, "Attack mismatch");
        assertEq(NodeLib.unpackDefensePower(packed), defense, "Defense mismatch");
        assertEq(NodeLib.unpackResources(packed), resources, "Resources mismatch");
    }

    /// @notice NodeLib field update'leri doğruluğu.
    function test_nodeLib_setFields() public pure {
        bytes32 packed = NodeLib.pack(address(0xbeef), 1, 1, 0, 0, 0);

        packed = NodeLib.setLevel(packed, 5);
        assertEq(NodeLib.unpackLevel(packed), 5, "Level should be 5");

        // Diğer alanlar değişmemeli
        assertEq(NodeLib.unpackOwner(packed), address(0xbeef), "Owner should not change");
        assertEq(NodeLib.unpackBuildingType(packed), 1, "BuildingType should not change");
    }

    /// @notice Fuzz test: pack → unpack round-trip.
    function testFuzz_packUnpackRoundTrip(
        address owner,
        uint8 bType,
        uint8 level,
        uint8 attack,
        uint8 defense,
        uint64 resources
    ) public pure {
        bytes32 packed = NodeLib.pack(owner, bType, level, attack, defense, resources);

        assertEq(NodeLib.unpackOwner(packed), owner);
        assertEq(NodeLib.unpackBuildingType(packed), bType);
        assertEq(NodeLib.unpackLevel(packed), level);
        assertEq(NodeLib.unpackAttackPower(packed), attack);
        assertEq(NodeLib.unpackDefensePower(packed), defense);
        assertEq(NodeLib.unpackResources(packed), resources);
    }
}
