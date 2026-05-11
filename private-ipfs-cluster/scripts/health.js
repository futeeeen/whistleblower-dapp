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

async function main() {
  const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
  const env = readEnv(envText);
  const apiUrl = env.CLUSTER_API_URL || "http://127.0.0.1:9094";
  const auth = Buffer.from(`${env.CLUSTER_API_USER || "admin"}:${env.CLUSTER_API_PASSWORD || ""}`).toString("base64");

  const response = await fetch(`${apiUrl}/id`, {
    headers: { Authorization: `Basic ${auth}` }
  });

  if (!response.ok) {
    throw new Error(`Cluster health failed: ${response.status} ${await response.text()}`);
  }

  console.log(JSON.stringify(await response.json(), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
