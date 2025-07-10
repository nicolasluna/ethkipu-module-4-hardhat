const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap", function () {
  let tokenA, tokenB, swap;
  let owner, addr1;
  const ONE_TOKEN = ethers.parseUnits("1", 18);

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy Token A and B
    const Token = await ethers.getContractFactory("CustomToken");
    tokenA = await Token.deploy("Token A", "TKA");
    await tokenA.waitForDeployment();

    tokenB = await Token.deploy("Token B", "TKB");
    await tokenB.waitForDeployment();

    // Deploy swap contract
    const Swap = await ethers.getContractFactory("SimpleSwap");
    swap = await Swap.deploy(await tokenA.getAddress(), await tokenB.getAddress());
    await swap.waitForDeployment();

    // Mint tokens to owner
    await tokenA.mint(owner.address, ethers.parseUnits("1000", 18));
    await tokenB.mint(owner.address, ethers.parseUnits("1000", 18));

    // Approve swap contract
    await tokenA.approve(await swap.getAddress(), ethers.parseUnits("1000", 18));
    await tokenB.approve(await swap.getAddress(), ethers.parseUnits("1000", 18));

    // Add liquidity
    const deadline = Math.floor(Date.now() / 1000) + 300;
    await swap.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      ethers.parseUnits("100", 18),
      ethers.parseUnits("200", 18),
      0,
      0,
      owner.address,
      deadline
    );
  });

  it("should allow token swap from A to B", async function () {
    await tokenA.mint(addr1.address, ethers.parseUnits("10", 18));
    await tokenA.connect(addr1).approve(await swap.getAddress(), ethers.parseUnits("10", 18));

    const path = [await tokenA.getAddress(), await tokenB.getAddress()];
    const deadline = Math.floor(Date.now() / 1000) + 300;

    const balanceBefore = await tokenB.balanceOf(addr1.address);

    await swap.connect(addr1).swapExactTokensForTokens(
      ethers.parseUnits("10", 18),
      1,
      path,
      addr1.address,
      deadline
    );

    const balanceAfter = await tokenB.balanceOf(addr1.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  it("should revert if deadline is passed", async function () {
    await tokenA.mint(addr1.address, ethers.parseUnits("5", 18));
    await tokenA.connect(addr1).approve(await swap.getAddress(), ethers.parseUnits("5", 18));

    const path = [await tokenA.getAddress(), await tokenB.getAddress()];
    const expiredDeadline = Math.floor(Date.now() / 1000) - 10;

    await expect(
      swap.connect(addr1).swapExactTokensForTokens(
        ethers.parseUnits("5", 18),
        1,
        path,
        addr1.address,
        expiredDeadline
      )
    ).to.be.revertedWith("Transaction expired");
  });

  it("should calculate the correct price", async function () {
    const price = await swap.getPrice(await tokenA.getAddress(), await tokenB.getAddress());
    expect(price).to.equal(ethers.parseUnits("2", 18)); // 100 A : 200 B → 1 A = 2 B
  });

  it("should return correct output in getAmountOut", async function () {
    const amountOut = await swap.getAmountOut(
      ethers.parseUnits("10", 18),
      ethers.parseUnits("100", 18),
      ethers.parseUnits("200", 18)
    );
    // expected: (10 * 200) / (100 + 10) = ~18.18
    expect(amountOut).to.equal(ethers.parseUnits("18.181818181818181818", 18));
  });

  it("should add liquidity and mint LP tokens", async function () {
    const totalSupply = await swap.totalSupply();
    expect(totalSupply).to.be.gt(0);
    const lpBalance = await swap.balanceOf(owner.address);
    expect(lpBalance).to.equal(totalSupply);
  });

  // add new liquidity with initial reserves > 0
  it("should allow adding liquidity with previuos total supply > 0", async function () {
    const initialReserveA = await swap.reserveA();
    const initialReserveB = await swap.reserveB();

    const amountA = ethers.parseUnits("50", 18);
    const amountB = ethers.parseUnits("100", 18);
    const deadline = Math.floor(Date.now() / 1000) + 300;

    await swap.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountA,
      amountB,
      10,
      10,
      owner.address,
      deadline
    );

    const newReserveA = await swap.reserveA();
    const newReserveB = await swap.reserveB();

    expect(newReserveA).to.equal(initialReserveA + amountA);
    expect(newReserveB).to.equal(initialReserveB + amountB);
  });

  it("should test public getters", async function () {
    // tokenA and tokenB
    expect(await swap.tokenA()).to.equal(await tokenA.getAddress());
    expect(await swap.tokenB()).to.equal(await tokenB.getAddress());

    // reserves
    const reserveA = await swap.reserveA();
    const reserveB = await swap.reserveB();

    // test reserves
    expect(reserveA).to.equal(ethers.parseUnits("100", 18));
    expect(reserveB).to.equal(ethers.parseUnits("200", 18));

    // totalSupply getter
    const supply = await swap.totalSupply();
    expect(supply).to.be.gt(0);

    // balanceOf
    const lpBalance = await swap.balanceOf(owner.address);
    expect(lpBalance).to.equal(supply);
  });

  it("should allow removing liquidity", async function () {
      const initialBalanceA = await tokenA.balanceOf(owner.address);
      const initialBalanceB = await tokenB.balanceOf(owner.address);
  
      const lpBalance = await swap.balanceOf(owner.address);
      const halfLiquidity = ethers.toBigInt(lpBalance) / 2n;
      const deadline = Math.floor(Date.now() / 1000) + 300;
  
      await swap.removeLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      halfLiquidity,
      0,
      0,
      owner.address,
      deadline
      );
  
      const finalBalanceA = await tokenA.balanceOf(owner.address);
      const finalBalanceB = await tokenB.balanceOf(owner.address);
  
      expect(finalBalanceA).to.be.gt(initialBalanceA);
      expect(finalBalanceB).to.be.gt(initialBalanceB);
  });
    
});
