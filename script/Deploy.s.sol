// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CyberNodeWorld} from "../src/CyberNodeWorld.sol";

/// @title Deploy — CyberNodeWorld Deployment Script
/// @notice Monad testnet'e CyberNodeWorld kontratını deploy eder.
/// @dev Kullanım:
///   forge script script/Deploy.s.sol:DeployScript \
///     --rpc-url <MONAD_RPC_URL> \
///     --private-key <DEPLOYER_PRIVATE_KEY> \
///     --broadcast \
///     --verify
contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CyberNodeWorld world = new CyberNodeWorld();

        console2.log("=== CYBER-NODE DEPLOYMENT ===");
        console2.log("CyberNodeWorld deployed at:", address(world));
        console2.log("MAX_NODES:", world.MAX_NODES());
        console2.log("NODES_PER_SUBNET:", world.NODES_PER_SUBNET());
        console2.log("TOTAL_SUBNETS:", world.TOTAL_SUBNETS());

        vm.stopBroadcast();
    }
}
