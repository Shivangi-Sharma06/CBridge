// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract cSETH is ERC20, Ownable {
    address public relayer;

    event Burned(address indexed user, uint256 amount);
    event RelayerUpdated(address indexed newRelayer);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    constructor(address _relayer) ERC20("Cross-Chain Staked ETH", "cSETH") Ownable(msg.sender) {
        require(_relayer != address(0), "Invalid relayer");
        relayer = _relayer;
    }

    function mint(address to, uint256 amount) external onlyRelayer {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Must mint amount");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        require(amount > 0, "Must burn amount");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "Invalid relayer");
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }
}