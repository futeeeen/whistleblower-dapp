process.stdin.setEncoding("utf8");

let input = "";

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", async () => {
  try {
    const { identityExport, members, message, scope } = JSON.parse(input);
    const { Identity } = await import("@semaphore-protocol/identity");
    const { Group } = await import("@semaphore-protocol/group");
    const { generateProof } = await import("@semaphore-protocol/proof");

    const identity = Identity.import(identityExport);
    const group = new Group(members);
    const proof = await generateProof(identity, group, message, scope);

    process.stdout.write(JSON.stringify({
      merkleTreeDepth: proof.merkleTreeDepth,
      merkleTreeRoot: proof.merkleTreeRoot.toString(),
      nullifier: proof.nullifier.toString(),
      message: proof.message.toString(),
      scope: proof.scope.toString(),
      points: proof.points
    }));
  } catch (error) {
    process.stderr.write(error.stack || error.message);
    process.exit(1);
  }
});
