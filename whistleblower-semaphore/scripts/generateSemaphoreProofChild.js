const { ethers } = require("ethers");
const { packGroth16Proof } = require("@zk-kit/utils/proof-packing");
const { groth16, wtns } = require("snarkjs");

process.stdin.setEncoding("utf8");

let input = "";

const debug = (message) => {
  if (process.env.PROOF_CHILD_DEBUG === "1") {
    process.stderr.write(`[proof-child] ${message}\n`);
  }
};

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", async () => {
  try {
    debug("input received");
    const { identityExport, members, message, scope } = JSON.parse(input);
    const { Identity } = await import("@semaphore-protocol/identity");
    const { Group } = await import("@semaphore-protocol/group");
    const { maybeGetSnarkArtifacts, Project } = await import("@zk-kit/artifacts");
    debug("imports loaded");

    const identity = Identity.import(identityExport);
    const group = new Group(members);
    const merkleProof = group.generateMerkleProof(group.indexOf(identity.commitment));
    const merkleTreeDepth = group.depth || 1;
    const merkleProofSiblings = [...merkleProof.siblings];

    for (let i = 0; i < merkleTreeDepth; i += 1) {
      if (merkleProofSiblings[i] === undefined) merkleProofSiblings[i] = 0n;
    }

    const artifacts = await maybeGetSnarkArtifacts(Project.SEMAPHORE, {
      parameters: [merkleTreeDepth],
      version: "4.13.0"
    });
    debug(`artifacts ready depth=${merkleTreeDepth}`);

    const hash = (value) => (
      BigInt(ethers.utils.keccak256(ethers.utils.hexZeroPad(ethers.BigNumber.from(value).toHexString(), 32))) >> 8n
    ).toString();

    // snarkjs on Node can hang when BigInt values are passed directly here.
    // Decimal strings keep the witness/proving path deterministic and fast.
    const witnessInput = {
      secret: identity.secretScalar.toString(),
      merkleProofLength: merkleProof.siblings.length.toString(),
      merkleProofIndex: merkleProof.index.toString(),
      merkleProofSiblings: merkleProofSiblings.map((sibling) => sibling.toString()),
      scope: hash(scope),
      message: hash(message)
    };

    const witness = { type: "mem" };
    await wtns.calculate(witnessInput, artifacts.wasm, witness, {});
    debug("witness calculated");
    const { proof: groth16Proof, publicSignals } = await groth16.prove(artifacts.zkey, witness);
    debug("proof generated");

    process.stdout.write(JSON.stringify({
      merkleTreeDepth,
      merkleTreeRoot: merkleProof.root.toString(),
      nullifier: publicSignals[1],
      message: ethers.BigNumber.from(message).toString(),
      scope: ethers.BigNumber.from(scope).toString(),
      points: packGroth16Proof(groth16Proof)
    }), () => process.exit(0));
  } catch (error) {
    process.stderr.write(error.stack || error.message);
    process.exit(1);
  }
});
