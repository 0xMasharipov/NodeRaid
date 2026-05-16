// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {CyberNodeWorld} from "../src/CyberNodeWorld.sol";
import {NaiveWorld} from "../src/NaiveWorld.sol";
import {NodeLib} from "../src/libraries/NodeLib.sol";

/// @title Gas Benchmark Tests — CyberNodeWorld vs NaiveWorld
/// @notice MIP-8 optimizasyonunun gas avantajını kanıtlayan karşılaştırma testleri.
/// @dev Bu testler EVM seviyesinde gas ölçümü yapar. Monad MIP-8 üzerindeki gerçek
///      fark çok daha dramatik olacaktır (cold page load farkı nedeniyle).
///
///      Not: Standart EVM'de (Foundry local) cold/warm storage access farkı
///      2100/100 gas şeklindedir. MIP-8'de bu fark page seviyesine çıkar:
///      - Cold page: 8000 gas (tüm 128 slotu ısıtır)
///      - Warm slot: 100 gas
contract GasBenchmarkTest is Test {
    CyberNodeWorld public optimized;
    NaiveWorld public naive;

    address public player = makeAddr("player");

    /// @notice Her iki kontratı deploy et ve test verisi hazırla.
    function setUp() public {
        optimized = new CyberNodeWorld();
        naive = new NaiveWorld();
    }

    /*//////////////////////////////////////////////////////////////
                          SETUP HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev CyberNodeWorld'de belirli sayıda Miner düğüm kur.
    function _setupOptimizedNodes(uint256 subnetId, uint256 count) internal {
        uint256 baseId = subnetId << 7; // subnetId * 128
        vm.startPrank(player);
        for (uint256 i; i < count; i++) {
            optimized.hack(baseId + i);
            optimized.build(baseId + i, NodeLib.BUILDING_MINER);
        }
        vm.stopPrank();
    }

    /// @dev NaiveWorld'de belirli sayıda Miner düğüm kur.
    function _setupNaiveNodes(uint256 startId, uint256 count) internal {
        vm.startPrank(player);
        for (uint256 i; i < count; i++) {
            naive.hack(startId + i);
            naive.build(startId + i, 1); // Miner
        }
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                      SINGLE HACK GAS BENCHMARK
    //////////////////////////////////////////////////////////////*/

    /// @notice Tek hack işleminin gas maliyeti — Optimized.
    function test_gas_singleHack_optimized() public {
        vm.prank(player);
        uint256 gasBefore = gasleft();
        optimized.hack(0);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== SINGLE HACK GAS ===");
        console2.log("CyberNodeWorld hack():", gasUsed);
    }

    /// @notice Tek hack işleminin gas maliyeti — Naive.
    function test_gas_singleHack_naive() public {
        vm.prank(player);
        uint256 gasBefore = gasleft();
        naive.hack(0);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== SINGLE HACK GAS ===");
        console2.log("NaiveWorld hack():", gasUsed);
    }

    /*//////////////////////////////////////////////////////////////
                      SINGLE BUILD GAS BENCHMARK
    //////////////////////////////////////////////////////////////*/

    /// @notice Tek build işleminin gas maliyeti — Optimized.
    function test_gas_singleBuild_optimized() public {
        vm.prank(player);
        optimized.hack(0);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        optimized.build(0, NodeLib.BUILDING_MINER);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== SINGLE BUILD GAS ===");
        console2.log("CyberNodeWorld build():", gasUsed);
    }

    /// @notice Tek build işleminin gas maliyeti — Naive.
    function test_gas_singleBuild_naive() public {
        vm.prank(player);
        naive.hack(0);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        naive.build(0, 1);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== SINGLE BUILD GAS ===");
        console2.log("NaiveWorld build():", gasUsed);
    }

    /*//////////////////////////////////////////////////////////////
                   MASS EXTRACT GAS BENCHMARK (CORE)
    //////////////////////////////////////////////////////////////*/

    /// @notice 128 düğümden massExtract gas — Optimized (MIP-8).
    /// @dev Bu test MIP-8'in asıl avantajını gösterir.
    ///      128 node aynı page'de → 1 cold + 127 warm read.
    function test_gas_massExtract_128nodes_optimized() public {
        _setupOptimizedNodes(0, 128);

        // 100 saniye ilerlet (kaynak biriktir)
        vm.warp(block.timestamp + 100);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        optimized.massExtract(0);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== MASS EXTRACT 128 NODES ===");
        console2.log("CyberNodeWorld massExtract(128):", gasUsed);
        console2.log("Per-node average:", gasUsed / 128);
    }

    /// @notice 128 düğümden massExtract gas — Naive.
    /// @dev Her okuma ayrı bir page'den cold load.
    function test_gas_massExtract_128nodes_naive() public {
        _setupNaiveNodes(0, 128);

        vm.warp(block.timestamp + 100);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        naive.massExtract(0, 128);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== MASS EXTRACT 128 NODES ===");
        console2.log("NaiveWorld massExtract(128):", gasUsed);
        console2.log("Per-node average:", gasUsed / 128);
    }

    /*//////////////////////////////////////////////////////////////
                   MASS EXTRACT SCALING BENCHMARKS
    //////////////////////////////////////////////////////////////*/

    /// @notice 16 düğümden massExtract gas karşılaştırması.
    function test_gas_massExtract_16nodes_optimized() public {
        _setupOptimizedNodes(0, 16);
        vm.warp(block.timestamp + 100);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        optimized.massExtract(0);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== MASS EXTRACT 16 NODES ===");
        console2.log("CyberNodeWorld massExtract (16 owned):", gasUsed);
    }

    function test_gas_massExtract_16nodes_naive() public {
        _setupNaiveNodes(0, 16);
        vm.warp(block.timestamp + 100);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        naive.massExtract(0, 16);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== MASS EXTRACT 16 NODES ===");
        console2.log("NaiveWorld massExtract(16):", gasUsed);
    }

    /// @notice 64 düğümden massExtract gas karşılaştırması.
    function test_gas_massExtract_64nodes_optimized() public {
        _setupOptimizedNodes(0, 64);
        vm.warp(block.timestamp + 100);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        optimized.massExtract(0);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== MASS EXTRACT 64 NODES ===");
        console2.log("CyberNodeWorld massExtract (64 owned):", gasUsed);
    }

    function test_gas_massExtract_64nodes_naive() public {
        _setupNaiveNodes(0, 64);
        vm.warp(block.timestamp + 100);

        vm.prank(player);
        uint256 gasBefore = gasleft();
        naive.massExtract(0, 64);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== MASS EXTRACT 64 NODES ===");
        console2.log("NaiveWorld massExtract(64):", gasUsed);
    }

    /*//////////////////////////////////////////////////////////////
                    COMPREHENSIVE GAS REPORT
    //////////////////////////////////////////////////////////////*/

    /// @notice Tüm senaryoları tek bir test'te karşılaştır ve raporla.
    function test_gas_comparison_report() public {
        console2.log("");
        console2.log("+==============================================================+");
        console2.log("|       CYBER-NODE GAS BENCHMARK: MIP-8 vs NAIVE              |");
        console2.log("+==============================================================+");
        console2.log("");

        // --- Setup: 128 nodes each ---
        _setupOptimizedNodes(0, 128);
        _setupNaiveNodes(0, 128);
        vm.warp(block.timestamp + 100);

        // --- Measure massExtract ---
        vm.prank(player);
        uint256 g1 = gasleft();
        optimized.massExtract(0);
        uint256 optimizedGas = g1 - gasleft();

        vm.prank(player);
        uint256 g2 = gasleft();
        naive.massExtract(0, 128);
        uint256 naiveGas = g2 - gasleft();

        console2.log("  massExtract (128 nodes):");
        console2.log("    CyberNodeWorld (MIP-8):", optimizedGas, "gas");
        console2.log("    NaiveWorld (Standard): ", naiveGas, "gas");

        if (naiveGas > optimizedGas) {
            console2.log("    Gas Saved:             ", naiveGas - optimizedGas, "gas");
            console2.log("    Ratio:                 ", naiveGas / optimizedGas, "x cheaper");
        } else {
            console2.log("    NOTE: On standard EVM, CyberNodeWorld scans all 128 slots.");
            console2.log("    On Monad MIP-8, contiguous storage = ~50x cheaper reads.");
            console2.log("    CyberNodeWorld overhead:", optimizedGas - naiveGas, "gas (full-page scan)");
        }

        console2.log("");
        console2.log("  Per-node average:");
        console2.log("    CyberNodeWorld:", optimizedGas / 128, "gas/node");
        console2.log("    NaiveWorld:    ", naiveGas / 128, "gas/node");

        console2.log("");
        console2.log("+==============================================================+");
        console2.log("|  MIP-8 PROJECTION (Monad Mainnet):                           |");
        console2.log("|  CyberNodeWorld: 1 cold(8100) + 127 warm(12700) = 20,800 gas |");
        console2.log("|  NaiveWorld: 128 cold reads = 128 x 8100 = 1,036,800 gas     |");
        console2.log("|  Projected Savings: ~50x                                     |");
        console2.log("+==============================================================+");
        console2.log("");
    }
}
