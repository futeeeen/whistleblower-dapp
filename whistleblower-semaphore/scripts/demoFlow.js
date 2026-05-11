const hre = require("hardhat");

async function main() {
  const { Identity } = await import("@semaphore-protocol/identity");
  const { Group } = await import("@semaphore-protocol/group");
  const { generateProof } = await import("@semaphore-protocol/proof");

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

  const groupId = Number((await app.groupId()).toString());
  console.log("Deployed app:", app.address, "groupId:", groupId);

  const employeeIdentity = new Identity();
  const commitment = employeeIdentity.commitment.toString();
  console.log("Employee commitment:", commitment);

  await (await app.addEmployeeMember(commitment)).wait();
  console.log("Member added to employee group");

  const group = new Group([commitment]);

  const ipfsCID = "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
  const messageHash = "sha256:demo-content-hash";
  const message = hre.ethers.BigNumber.from(
    hre.ethers.utils.keccak256(
      hre.ethers.utils.solidityPack(["string", "string"], [ipfsCID, messageHash])
    )
  ).toString();
  const scope = hre.ethers.BigNumber.from(groupId).toString();

  const proof = await generateProof(employeeIdentity, group, message, scope);

  const solidityProof = {
    merkleTreeDepth: proof.merkleTreeDepth,
    merkleTreeRoot: proof.merkleTreeRoot.toString(),
    nullifier: proof.nullifier.toString(),
    message: proof.message.toString(),
    scope: proof.scope.toString(),
    points: proof.points
  };

  await (await app.submitAnonymousReport(ipfsCID, messageHash, solidityProof)).wait();
  console.log("First anonymous report submitted");

  try {
    await (await app.submitAnonymousReport(ipfsCID, messageHash, solidityProof)).wait();
    console.log("Unexpected: second report with same nullifier succeeded");
  } catch (err) {
    console.log("Second submission rejected as expected (nullifier replay blocked)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
