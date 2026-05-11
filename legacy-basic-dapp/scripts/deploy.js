const hre = require("hardhat");

async function main() {
  const Whistleblower = await hre.ethers.getContractFactory("Whistleblower");

  console.log("Deploying contract...");
  const contract = await Whistleblower.deploy();
  await contract.deployed();

  console.log("====================================");
  console.log("Whistleblower deployed successfully");
  console.log("Contract address:", contract.address);
  console.log("====================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
