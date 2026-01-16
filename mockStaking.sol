// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockStaking is ERC20, Ownable {
    uint256 public totalETHBacking;

    event Staked(address indexed user, uint256 ethAmount, uint256 shares);
    event Unstaked(address indexed user, uint256 shares, uint256 ethAmount);
    event RewardsAdded(uint256 amount);
    event Slashed(uint256 percentage, uint256 amountSlashed);

    constructor() ERC20("Staked ETH", "sETH") Ownable(msg.sender) {}

    function stake() external payable {
        require(msg.value > 0, "Must stake ETH");

        uint256 shares;
        if (totalSupply() == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalSupply()) / totalETHBacking;
        }

        totalETHBacking += msg.value;
        _mint(msg.sender, shares);

        emit Staked(msg.sender, msg.value, shares);
    }

    function unstake(uint256 shares) external {
        require(shares > 0, "Must unstake shares");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");

        uint256 ethAmount = (shares * totalETHBacking) / totalSupply();
        
        _burn(msg.sender, shares);
        totalETHBacking -= ethAmount;

        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");

        emit Unstaked(msg.sender, shares, ethAmount);
    }

    function addRewards() external payable onlyOwner {
        require(msg.value > 0, "Must add rewards");
        totalETHBacking += msg.value;
        emit RewardsAdded(msg.value);
    }

    function slash(uint256 percentage) external onlyOwner {
        require(percentage > 0 && percentage <= 100, "Invalid percentage");
        
        uint256 slashAmount = (totalETHBacking * percentage) / 100;
        totalETHBacking -= slashAmount;

        (bool success, ) = owner().call{value: slashAmount}("");
        require(success, "Slash transfer failed");

        emit Slashed(percentage, slashAmount);
    }

    function exchangeRate() external view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        return (totalETHBacking * 1e18) / totalSupply();
    }

    receive() external payable {
        revert("Use stake() function");
    }
}