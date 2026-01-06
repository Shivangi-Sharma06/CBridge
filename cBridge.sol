// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockStaking
 * @author Shivangi (CBridge Project)
 *
 * @notice
 * A simplified liquid staking contract for prototyping cross-chain LST bridges.
 * - Users deposit ETH
 * - Receive sETH (staking shares)
 * - Rewards increase ETH backing
 * - Slashing decreases ETH backing
 *
 * This is NOT production staking.
 */
contract MockStaking is ERC20, Ownable {
    /// @notice Total ETH backing all sETH
    uint256 public totalEthStaked;

    constructor() ERC20("Staked ETH", "sETH") {}

    /*//////////////////////////////////////////////////////////////
                                STAKING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Stake ETH and receive sETH
     */
    function stake() external payable {
        require(msg.value > 0, "Zero ETH");

        uint256 sharesToMint;

        if (totalSupply() == 0) {
            // First staker: 1 ETH = 1 sETH
            sharesToMint = msg.value;
        } else {
            // Share-based minting
            sharesToMint = (msg.value * totalSupply()) / totalEthStaked;
        }

        totalEthStaked += msg.value;
        _mint(msg.sender, sharesToMint);
    }

    /*//////////////////////////////////////////////////////////////
                                UNSTAKING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Burn sETH and withdraw ETH
     */
    function unstake(uint256 shares) external {
        require(shares > 0, "Zero shares");
        require(balanceOf(msg.sender) >= shares, "Insufficient balance");

        uint256 ethToReturn = (shares * totalEthStaked) / totalSupply();

        _burn(msg.sender, shares);
        totalEthStaked -= ethToReturn;

        (bool success, ) = msg.sender.call{value: ethToReturn}("");
        require(success, "ETH transfer failed");
    }

    /*//////////////////////////////////////////////////////////////
                            REWARD SIMULATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Simulate staking rewards (admin only)
     * @dev Adds ETH backing without minting new sETH
     */
    function addRewards() external payable onlyOwner {
        require(msg.value > 0, "Zero rewards");
        totalEthStaked += msg.value;
    }

    /*//////////////////////////////////////////////////////////////
                            SLASHING SIMULATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Simulate slashing (admin only)
     * @param percentage Slashing percentage (e.g. 10 = 10%)
     */
    function slash(uint256 percentage) external onlyOwner {
        require(percentage > 0 && percentage <= 100, "Invalid percentage");

        uint256 slashAmount = (totalEthStaked * percentage) / 100;
        totalEthStaked -= slashAmount;
        // ETH is simply removed from backing (burned)
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice ETH value of 1 sETH (scaled by 1e18)
     */
    function exchangeRate() external view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        return (totalEthStaked * 1e18) / totalSupply();
    }

    receive() external payable {
        revert("Use stake()");
    }
}
