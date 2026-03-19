import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PredictionEscrow", function () {
  const STAKE = ethers.parseUnits("10", 6); // 10 USDC
  const ONE_DAY = 86400;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const MOCK_BOND = ethers.parseUnits("1", 6); // 1 USDC

  async function deployFixture() {
    const [owner, partyYes, partyNo, outsider] = await ethers.getSigners();

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy mock oracle
    const MockOO = await ethers.getContractFactory("MockOptimisticOracleV3");
    const oracle = await MockOO.deploy();

    // Deploy factory
    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(
      await oracle.getAddress(),
      await usdc.getAddress()
    );

    const deadline = (await time.latest()) + ONE_DAY;

    // Create escrow via factory
    const tx = await factory.createEscrow(
      partyYes.address,
      partyNo.address,
      STAKE,
      deadline,
      "Test prediction"
    );
    const receipt = await tx.wait();

    const escrowAddr = await factory.getEscrow(0);
    const escrow = await ethers.getContractAt("PredictionEscrow", escrowAddr);

    // Mint USDC to parties
    await usdc.mint(partyYes.address, STAKE);
    await usdc.mint(partyNo.address, STAKE);
    // Mint bond to escrow (for UMA bond)
    await usdc.mint(escrowAddr, MOCK_BOND);

    // Approve escrow
    await usdc.connect(partyYes).approve(escrowAddr, STAKE);
    await usdc.connect(partyNo).approve(escrowAddr, STAKE);

    return { factory, escrow, usdc, oracle, owner, partyYes, partyNo, outsider, deadline };
  }

  describe("Factory", function () {
    it("creates escrow with correct params", async function () {
      const { factory, escrow, partyYes, partyNo, deadline } = await loadFixture(deployFixture);

      expect(await escrow.partyYes()).to.equal(partyYes.address);
      expect(await escrow.partyNo()).to.equal(partyNo.address);
      expect(await escrow.stakeAmount()).to.equal(STAKE);
      expect(await escrow.deadline()).to.equal(deadline);
      expect(await escrow.description()).to.equal("Test prediction");
      expect(await escrow.state()).to.equal(0); // Created
      expect(await factory.getEscrowCount()).to.equal(1);
    });

    it("emits EscrowCreated event", async function () {
      const { factory, partyYes, partyNo } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + ONE_DAY;

      await expect(
        factory.createEscrow(partyYes.address, partyNo.address, STAKE, deadline, "Another bet")
      ).to.emit(factory, "EscrowCreated");
    });
  });

  describe("Deposits", function () {
    it("both parties deposit and state becomes Funded", async function () {
      const { escrow, partyYes, partyNo } = await loadFixture(deployFixture);

      await escrow.connect(partyYes).deposit();
      expect(await escrow.state()).to.equal(0); // Still Created after one deposit

      await escrow.connect(partyNo).deposit();
      expect(await escrow.state()).to.equal(1); // Funded
    });

    it("reverts on wrong party", async function () {
      const { escrow, outsider } = await loadFixture(deployFixture);

      await expect(escrow.connect(outsider).deposit()).to.be.revertedWith("Not a party");
    });

    it("reverts on double deposit", async function () {
      const { escrow, partyYes } = await loadFixture(deployFixture);

      await escrow.connect(partyYes).deposit();
      await expect(escrow.connect(partyYes).deposit()).to.be.revertedWith("Already deposited");
    });
  });

  describe("Resolution", function () {
    async function fundedFixture() {
      const fixture = await deployFixture();
      await fixture.escrow.connect(fixture.partyYes).deposit();
      await fixture.escrow.connect(fixture.partyNo).deposit();
      return fixture;
    }

    it("cannot resolve before deadline", async function () {
      const { escrow } = await loadFixture(fundedFixture);
      const claim = ethers.toUtf8Bytes("The prediction is true");

      await expect(
        escrow.initiateResolution(claim, true)
      ).to.be.revertedWith("Before deadline");
    });

    it("resolution flow: initiate → callback(true) → winner paid", async function () {
      const { escrow, oracle, usdc, partyYes, deadline } = await loadFixture(fundedFixture);

      await time.increaseTo(deadline);

      const claim = ethers.toUtf8Bytes("The prediction is true");
      const tx = await escrow.initiateResolution(claim, true);
      await tx.wait();

      expect(await escrow.state()).to.equal(2); // Resolving

      const assertionId = await escrow.assertionId();

      const balanceBefore = await usdc.balanceOf(partyYes.address);

      // Oracle resolves truthfully
      await oracle.resolveAssertion(assertionId, true);

      expect(await escrow.state()).to.equal(3); // Settled
      expect(await escrow.resolvedYes()).to.equal(true);

      const balanceAfter = await usdc.balanceOf(partyYes.address);
      expect(balanceAfter - balanceBefore).to.equal(STAKE * 2n);
    });

    it("resolution with No outcome pays partyNo", async function () {
      const { escrow, oracle, usdc, partyNo, deadline } = await loadFixture(fundedFixture);

      await time.increaseTo(deadline);

      const claim = ethers.toUtf8Bytes("The prediction is false");
      await escrow.initiateResolution(claim, false);

      const assertionId = await escrow.assertionId();
      const balanceBefore = await usdc.balanceOf(partyNo.address);

      await oracle.resolveAssertion(assertionId, true);

      expect(await escrow.resolvedYes()).to.equal(false);
      const balanceAfter = await usdc.balanceOf(partyNo.address);
      expect(balanceAfter - balanceBefore).to.equal(STAKE * 2n);
    });

    it("disputed flow: callback(false) → state resets to Funded", async function () {
      const { escrow, oracle, usdc, deadline } = await loadFixture(fundedFixture);

      await time.increaseTo(deadline);

      const claim = ethers.toUtf8Bytes("The prediction is true");
      await escrow.initiateResolution(claim, true);

      const assertionId = await escrow.assertionId();

      // Oracle resolves as not truthful (disputed and lost)
      await oracle.resolveAssertion(assertionId, false);

      expect(await escrow.state()).to.equal(1); // Back to Funded
      expect(await escrow.assertionId()).to.equal(ethers.ZeroHash);
    });
  });

  describe("Expiry", function () {
    it("refunds both parties after deadline + 7 days", async function () {
      const { escrow, usdc, partyYes, partyNo, deadline } = await loadFixture(deployFixture);

      await escrow.connect(partyYes).deposit();
      await escrow.connect(partyNo).deposit();

      await time.increaseTo(deadline + SEVEN_DAYS);

      const yesBalBefore = await usdc.balanceOf(partyYes.address);
      const noBalBefore = await usdc.balanceOf(partyNo.address);

      await escrow.expire();

      expect(await escrow.state()).to.equal(4); // Expired
      expect(await usdc.balanceOf(partyYes.address) - yesBalBefore).to.equal(STAKE);
      expect(await usdc.balanceOf(partyNo.address) - noBalBefore).to.equal(STAKE);
    });

    it("cannot expire before deadline + 7 days", async function () {
      const { escrow, deadline } = await loadFixture(deployFixture);

      await time.increaseTo(deadline);

      await expect(escrow.expire()).to.be.revertedWith("Not expired yet");
    });

    it("refunds partial deposits on expiry", async function () {
      const { escrow, usdc, partyYes, deadline } = await loadFixture(deployFixture);

      await escrow.connect(partyYes).deposit();

      await time.increaseTo(deadline + SEVEN_DAYS);

      const balBefore = await usdc.balanceOf(partyYes.address);
      await escrow.expire();

      expect(await usdc.balanceOf(partyYes.address) - balBefore).to.equal(STAKE);
    });
  });
});
