// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CBridgeVault is Ownable {
    IERC20 public immutable sETH;
    address public relayer;
    
    mapping(address => uint256) public lockedBalances;
    uint256 public totalLocked;

    event Locked(address indexed user, uint256 amount);
    event Unlocked(address indexed user, uint256 amount);
    event MintConfirmed(address indexed user, uint256 amount);
    event BurnConfirmed(address indexed user, uint256 amount);
    event RelayerUpdated(address indexed newRelayer);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    constructor(address _sETH, address _relayer) Ownable(msg.sender) {
        require(_sETH != address(0), "Invalid sETH");
        require(_relayer != address(0), "Invalid relayer");
        sETH = IERC20(_sETH);
        relayer = _relayer;
    }

    function lock(uint256 amount) external {
        require(amount > 0, "Must lock amount");
        
        sETH.transferFrom(msg.sender, address(this), amount);
        
        lockedBalances[msg.sender] += amount;
        totalLocked += amount;

        emit Locked(msg.sender, amount);
    }

    function unlock(address user, uint256 amount) external onlyRelayer {
        require(amount > 0, "Must unlock amount");
        require(lockedBalances[user] >= amount, "Insufficient locked balance");
        
        lockedBalances[user] -= amount;
        totalLocked -= amount;

        sETH.transfer(user, amount);

        emit Unlocked(user, amount);
    }

    function confirmMint(address user, uint256 amount) external onlyRelayer {
        emit MintConfirmed(user, amount);
    }

    function confirmBurn(address user, uint256 amount) external onlyRelayer {
        emit BurnConfirmed(user, amount);
    }

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "Invalid relayer");
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    function invariantCheck() external view returns (bool) {
        return sETH.balanceOf(address(this)) >= totalLocked;
    }
}