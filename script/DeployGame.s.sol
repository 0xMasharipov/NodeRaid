// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CyberNodeGame} from "../src/CyberNodeGame.sol";

/// @title DeployGame — CyberNodeGame Deployment Script
/// @dev Kullanım:
///   forge script script/DeployGame.s.sol:DeployGameScript \
///     --rpc-url https://testnet-rpc.monad.xyz/ \
///     --private-key <DEPLOYER_PRIVATE_KEY> \
///     --broadcast
contract DeployGameScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CyberNodeGame game = new CyberNodeGame();

        console2.log("=== CYBER-NODE GAME DEPLOYMENT ===");
        console2.log("CyberNodeGame deployed at:", address(game));
        console2.log("INITIAL_RESOURCES:", game.INITIAL_RESOURCES());
        console2.log("COST_MAINFRAME:", game.COST_MAINFRAME());
        console2.log("COST_MINER:", game.COST_MINER());
        console2.log("COST_FIREWALL:", game.COST_FIREWALL());
        console2.log("COST_DATACENTER:", game.COST_DATACENTER());

        vm.stopBroadcast();
    }
}
