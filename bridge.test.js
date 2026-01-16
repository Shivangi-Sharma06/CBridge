const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CBridge System", function () {
  let mockStaking, vault, cseth;
  let owner, relayer, user1, user2;

  beforeEach(async function () {
    [owner, relayer, user1, user2] = await ethers.getSigners();
    
    const MockStaking = await ethers.getContractFactory("MockStaking");
    mockStaking = await MockStaking.deploy();
    await mockStaking.waitForDeployment();

    const CBridgeVault = await ethers.getContractFactory("CBridgeVault");
    vault = await CBridgeVault.deploy(
      await mockStaking.getAddress(),
      relayer.address
    );
    await vault.waitForDeployment();

    const cSETH = await ethers.getContractFactory("cSETH");
    cseth = await cSETH.deploy(relayer.address);
    await cseth.waitForDeployment();

    await mockStaking.connect(user1).stake({ value: ethers.parseEther("10") });
  });

  describe("Locking", function () {
    it("should lock sETH and emit event", async function () {
      const lockAmount = ethers.parseEther("5");
      
      await mockStaking.connect(user1).approve(await vault.getAddress(), lockAmount);
      
      await expect(vault.connect(user1).lock(lockAmount))
        .to.emit(vault, "Locked")
        .withArgs(user1.address, lockAmount);
      
      expect(await vault.lockedBalances(user1.address)).to.equal(lockAmount);
      expect(await vault.totalLocked()).to.equal(lockAmount);
    });

    it("should revert on zero amount", async function () {
      await expect(vault.connect(user1).lock(0)).to.be.revertedWith("Must lock amount");
    });

    it("should maintain invariant", async function () {
      const lockAmount = ethers.parseEther("5");
      await mockStaking.connect(user1).approve(await vault.getAddress(), lockAmount);
      await vault.connect(user1).lock(lockAmount);
      
      expect(await vault.invariantCheck()).to.be.true;
    });
  });

  describe("Minting cSETH", function () {
    it("should allow relayer to mint", async function () {
      const mintAmount = ethers.parseEther("5");
      
      await cseth.connect(relayer).mint(user1.address, mintAmount);
      
      expect(await cseth.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("should revert when non-relayer mints", async function () {
      await expect(
        cseth.connect(user1).mint(user1.address, ethers.parseEther("5"))
      ).to.be.revertedWith("Not relayer");
    });
  });

  describe("Burning cSETH", function () {
    beforeEach(async function () {
      await cseth.connect(relayer).mint(user1.address, ethers.parseEther("5"));
    });

    it("should allow users to burn and emit event", async function () {
      const burnAmount = ethers.parseEther("3");
      
      await expect(cseth.connect(user1).burn(burnAmount))
        .to.emit(cseth, "Burned")
        .withArgs(user1.address, burnAmount);
      
      expect(await cseth.balanceOf(user1.address)).to.equal(ethers.parseEther("2"));
    });

    it("should revert on insufficient balance", async function () {
      await expect(
        cseth.connect(user1).burn(ethers.parseEther("10"))
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Unlocking", function () {
    beforeEach(async function () {
      const lockAmount = ethers.parseEther("5");
      await mockStaking.connect(user1).approve(await vault.getAddress(), lockAmount);
      await vault.connect(user1).lock(lockAmount);
    });

    it("should allow relayer to unlock", async function () {
      const unlockAmount = ethers.parseEther("3");
      
      await expect(vault.connect(relayer).unlock(user1.address, unlockAmount))
        .to.emit(vault, "Unlocked")
        .withArgs(user1.address, unlockAmount);
      
      expect(await vault.lockedBalances(user1.address)).to.equal(ethers.parseEther("2"));
      expect(await mockStaking.balanceOf(user1.address)).to.equal(ethers.parseEther("8"));
    });

    it("should revert when non-relayer unlocks", async function () {
      await expect(
        vault.connect(user1).unlock(user1.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Not relayer");
    });

    it("should revert on insufficient locked balance", async function () {
      await expect(
        vault.connect(relayer).unlock(user1.address, ethers.parseEther("10"))
      ).to.be.revertedWith("Insufficient locked balance");
    });
  });

  describe("Full Bridge Flow", function () {
    it("should complete lock -> mint -> burn -> unlock", async function () {
      const amount = ethers.parseEther("5");
      
      await mockStaking.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).lock(amount);
      expect(await vault.lockedBalances(user1.address)).to.equal(amount);
      
      await cseth.connect(relayer).mint(user1.address, amount);
      expect(await cseth.balanceOf(user1.address)).to.equal(amount);
      
      await cseth.connect(user1).burn(amount);
      expect(await cseth.balanceOf(user1.address)).to.equal(0);
      
      await vault.connect(relayer).unlock(user1.address, amount);
      expect(await vault.lockedBalances(user1.address)).to.equal(0);
      expect(await mockStaking.balanceOf(user1.address)).to.equal(ethers.parseEther("10"));
    });
  });

  describe("Slashing Impact", function () {
    it("should reduce redeemable value after slash", async function () {
      const lockAmount = ethers.parseEther("10");
      await mockStaking.connect(user1).approve(await vault.getAddress(), lockAmount);
      await vault.connect(user1).lock(lockAmount);
      
      const exchangeRateBefore = await mockStaking.exchangeRate();
      
      await mockStaking.slash(50);
      
      const exchangeRateAfter = await mockStaking.exchangeRate();
      expect(exchangeRateAfter).to.equal(exchangeRateBefore / 2n);
      
      await vault.connect(relayer).unlock(user1.address, lockAmount);
      
      const totalBacking = await mockStaking.totalETHBacking();
      const totalShares = await mockStaking.totalSupply();
      const userValue = (lockAmount * totalBacking) / totalShares;
      
      expect(userValue).to.be.closeTo(ethers.parseEther("5"), ethers.parseEther("0.01"));
    });
  });

  describe("Multiple Users", function () {
    it("should handle multiple users correctly", async function () {
      await mockStaking.connect(user2).stake({ value: ethers.parseEther("10") });
      
      const user1Amount = ethers.parseEther("4");
      const user2Amount = ethers.parseEther("6");
      
      await mockStaking.connect(user1).approve(await vault.getAddress(), user1Amount);
      await vault.connect(user1).lock(user1Amount);
      
      await mockStaking.connect(user2).approve(await vault.getAddress(), user2Amount);
      await vault.connect(user2).lock(user2Amount);
      
      expect(await vault.totalLocked()).to.equal(ethers.parseEther("10"));
      expect(await vault.lockedBalances(user1.address)).to.equal(user1Amount);
      expect(await vault.lockedBalances(user2.address)).to.equal(user2Amount);
    });
  });
});