// html element references
const tokenAInput = document.getElementById("tokenA");
const tokenBInput = document.getElementById("tokenB");
const status = document.getElementById("status");
const connectWalletBtn = document.getElementById("connectWallet");
const balanceASpan = document.getElementById("balanceA");
const balanceBSpan = document.getElementById("balanceB");

const TOKEN_A_ADDRESS = "0xd1cDD903d12f3121Ff485816bD75eb578A0c46B8";
const TOKEN_B_ADDRESS = "0x8bA5C03c115333286aBC11A74a917146acFB790A";
const SWAP_CONTRACT_ADDRESS = "0xF81AeaA87956CC4f7bf0CA39EEd3D28143E7EA31";
// abi for the swap contract
const ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getPrice(address _tokenA, address _tokenB) external view returns (uint price)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

let provider, signer, swapContract;

connectWalletBtn.onclick = async () => {
  if (!window.ethereum) {
    return alert("MetaMask is required.");
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  const address = await signer.getAddress();
  walletAddress.innerText = `Connected: ${address}`;

  swapContract = new ethers.Contract(SWAP_CONTRACT_ADDRESS, ABI, signer);
  await updateBalances(address);
};

// TODO: review this method to estimate tokenB based on input for tokenA
tokenAInput.addEventListener("input", async () => {
  const amountA = tokenAInput.value;
  if (!swapContract || !amountA || isNaN(amountA)) return;

  try {
    const price = await swapContract.getPrice(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS);
    const estimated = (parseFloat(amountA) * parseFloat(ethers.utils.formatUnits(price, 18))).toFixed(6);
    tokenBInput.value = estimated;
  } catch (err) {
    console.log("Error fetching price:", err);
  }
});

swapButton.onclick = async () => {
  const amountIn = tokenAInput.value;

  if (!amountIn || isNaN(amountIn)) {
    return (status.innerText = "Please enter a valid Token A amount.");
  }

  const userAddress = await signer.getAddress();
  const amountInWei = ethers.utils.parseUnits(amountIn, 18);
  const amountOutMin = 1; // TODO: test with different values
  const deadline = Math.floor(Date.now() / 1000) + 300; // +5 minutes

  const tokenAContract = new ethers.Contract(TOKEN_A_ADDRESS, [
    "function approve(address spender, uint amount) public returns (bool)",
  ], signer);

  try {
    status.innerText = "Approving tokens...";
    const txApprove = await tokenAContract.approve(SWAP_CONTRACT_ADDRESS, amountInWei);
    await txApprove.wait();

    status.innerText = "Swapping tokens...";
    const tx = await swapContract.swapExactTokensForTokens(
      amountInWei,
      amountOutMin,
      [TOKEN_A_ADDRESS, TOKEN_B_ADDRESS],
      userAddress,
      deadline
    );

    await tx.wait();
    status.innerText = "Swap completed!";
  } catch (error) {
    console.error(error);
    status.innerText = "Swap failed. Check console.";
  }
};

// show wallet balances
async function updateBalances(userAddress) {
    try {
      const tokenA = new ethers.Contract(TOKEN_A_ADDRESS, ABI, provider);
      const tokenB = new ethers.Contract(TOKEN_B_ADDRESS, ABI, provider);

      const [balanceA, balanceB] = await Promise.all([
        tokenA.balanceOf(userAddress),
        tokenB.balanceOf(userAddress)
      ]);

      const [decimalsA, decimalsB] = await Promise.all([
        tokenA.decimals(),
        tokenB.decimals()
      ]);

      const formattedA = ethers.utils.formatUnits(balanceA, decimalsA);
      const formattedB = ethers.utils.formatUnits(balanceB, decimalsB);

      balanceASpan.innerText = `(balance: ${formattedA})`;
      balanceBSpan.innerText = `(balance: ${formattedB})`;
    } catch (err) {
      console.error("Error fetching balances:", err);
    }
  }
