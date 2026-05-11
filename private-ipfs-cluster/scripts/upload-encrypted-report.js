import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function readEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

async function loadConfig() {
  const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
  const env = readEnv(envText);
  return {
    apiUrl: env.CLUSTER_API_URL || "http://127.0.0.1:9094",
    user: env.CLUSTER_API_USER || "admin",
    password: env.CLUSTER_API_PASSWORD || ""
  };
}

function getArg(name) {
  const prefix = `--${name}=`;
  const item = process.argv.find((arg) => arg.startsWith(prefix));
  return item ? item.slice(prefix.length) : "";
}

function usage() {
  console.log(`
Usage:
  npm run upload -- --file=./shared/encrypted-report.txt
  npm run upload -- --text="encrypted payload"

Output:
  ipfsCID and sha256 hash. Put only these two values on-chain.
`);
}

async function main() {
  const file = getArg("file");
  const text = getArg("text");

  if (!file && !text) {
    usage();
    process.exitCode = 1;
    return;
  }

  const payload = file ? await readFile(file) : Buffer.from(text, "utf8");
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const { apiUrl, user, password } = await loadConfig();

  const form = new FormData();
  form.append("file", new Blob([payload]), file ? file.split(/[\\/]/).pop() : "encrypted-report.txt");

  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const response = await fetch(`${apiUrl}/add?cid-version=1&replication-min=1&replication-max=2`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cluster add failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  const cid = result.cid?.["/"] || result.cid || result.Cid || result.Name || "";

  console.log(JSON.stringify({
    ipfsCID: cid,
    contentHash: `sha256:${sha256}`,
    bytes: payload.length,
    clusterApi: apiUrl
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
