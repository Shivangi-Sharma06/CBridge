const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockStaking", function () {
  let mockStaking;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const MockStaking = await ethers.getContractFactory("MockStaking");
    mockStaking = await MockStaking.deploy();
    await mockStaking.waitForDeployment();
  });

  describe("Staking", function () {
    it("should mint sETH 1:1 on first stake", async function () {
      const stakeAmount = ethers.parseEther("1");
      
      await mockStaking.connect(user1).stake({ value: stakeAmount });
      
      expect(await mockStaking.balanceOf(user1.address)).to.equal(stakeAmount);
      expect(await mockStaking.totalETHBacking()).to.equal(stakeAmount);
    });

    it("should mint proportional shares after rewards", async function () {
      await mockStaking.connect(user1).stake({ value: ethers.parseEther("10") });
      await mockStaking.addRewards({ value: ethers.parseEther("5") });
      
      const user2Stake = ethers.parseEther("3");
      await mockStaking.connect(user2).stake({ value: user2Stake });
      
      const expectedShares = (user2Stake * ethers.parseEther("10")) / ethers.parseEther("15");
      expect(await mockStaking.balanceOf(user2.address)).to.equal(expectedShares);
    });

    it("should revert on zero stake", async function () {
      await expect(
        mockStaking.connect(user1).stake({ value: 0 })
      ).to.be.revertedWith("Must stake ETH");
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await mockStaking.connect(user1).stake({ value: ethers.parseEther("10") });
    });

    it("should return proportional ETH", async function () {
      const shares = await mockStaking.balanceOf(user1.address);
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await mockStaking.connect(user1).unstake(shares);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const ethReceived = balanceAfter - balanceBefore + gasCost;
      
      expect(ethReceived).to.equal(ethers.parseEther("10"));
      expect(await mockStaking.balanceOf(user1.address)).to.equal(0);
    });

    it("should revert on insufficient shares", async function () {
      await expect(
        mockStaking.connect(user2).unstake(ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient shares");
    });
  });

  describe("Rewards", function () {
    it("should increase exchange rate", async function () {
      await mockStaking.connect(user1).stake({ value: ethers.parseEther("10") });
      
      const rateBefore = await mockStaking.exchangeRate();
      await mockStaking.addRewards({ value: ethers.parseEther("2") });
      const rateAfter = await mockStaking.exchangeRate();
      
      expect(rateAfter).to.be.gt(rateBefore);
    });
  });

  describe("Slashing", function () {
    beforeEach(async function () {
      await mockStaking.connect(user1).stake({ value: ethers.parseEther("10") });
    });

    it("should reduce backing proportionally", async function () {
      const backingBefore = await mockStaking.totalETHBacking();
      
      await mockStaking.slash(20);
      
      const backingAfter = await mockStaking.totalETHBacking();
      expect(backingAfter).to.equal(backingBefore * 80n / 100n);
    });

    it("should affect all holders proportionally", async function () {
      await mockStaking.connect(user2).stake({ value: ethers.parseEther("10") });
      
      const user1Shares = await mockStaking.balanceOf(user1.address);
      const user2Shares = await mockStaking.balanceOf(user2.address);
      
      await mockStaking.slash(50);
      
      const totalBacking = await mockStaking.totalETHBacking();
      const totalShares = await mockStaking.totalSupply();
      
      const user1Value = (user1Shares * totalBacking) / totalShares;
      const user2Value = (user2Shares * totalBacking) / totalShares;
      
      expect(user1Value).to.be.closeTo(ethers.parseEther("5"), ethers.parseEther("0.01"));
      expect(user2Value).to.be.closeTo(ethers.parseEther("5"), ethers.parseEther("0.01"));
    });

    it("should revert on invalid percentage", async function () {
      await expect(mockStaking.slash(0)).to.be.revertedWith("Invalid percentage");
      await expect(mockStaking.slash(101)).to.be.revertedWith("Invalid percentage");
    });
  });
});