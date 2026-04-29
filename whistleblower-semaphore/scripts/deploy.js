const hre = require("hardhat");

async function main() {
  const PoseidonT3 = await hre.ethers.getContractFactory("PoseidonT3");
  const poseidonT3 = await PoseidonT3.deploy();
  await poseidonT3.deployed();

  const Verifier = await hre.ethers.getContractFactory("LocalSemaphoreVerifier");
  const verifier = await Verifier.deploy();
  await verifier.deployed();

  const Semaphore = await hre.ethers.getContractFactory("LocalSemaphore", {
    libraries: {
      PoseidonT3: poseidonT3.address
    }
  });
  const semaphore = await Semaphore.deploy(verifier.address);
  await semaphore.deployed();

  const App = await hre.ethers.getContractFactory("EmployeeSemaphoreWhistleblower");
  const app = await App.deploy(semaphore.address);
  await app.deployed();

  console.log("PoseidonT3:", poseidonT3.address);
  console.log("SemaphoreVerifier:", verifier.address);
  console.log("Semaphore:", semaphore.address);
  console.log("EmployeeSemaphoreWhistleblower:", app.address);

  const groupId = await app.groupId();
  console.log("Group ID:", groupId.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
