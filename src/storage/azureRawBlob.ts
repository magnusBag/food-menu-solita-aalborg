import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  type BlobRequestConditions,
} from "@azure/storage-blob";

const DEFAULT_CONTAINER = "weekly-food-menu";

function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getContainerName(): string {
  return process.env.AZURE_STORAGE_CONTAINER_NAME || DEFAULT_CONTAINER;
}

function getBlobServiceClient(): BlobServiceClient {
  const v = getRequiredEnv("AZURE_STORAGE_CONNECTION_STRING");

  if (v.includes("BlobEndpoint=") && v.includes("SharedAccessSignature=")) {
    const parts = v.split(";").filter(Boolean);
    const blobEndpoint = parts
      .find((p) => p.startsWith("BlobEndpoint="))
      ?.slice("BlobEndpoint=".length);
    const sas = parts
      .find((p) => p.startsWith("SharedAccessSignature="))
      ?.slice("SharedAccessSignature=".length);
    if (!blobEndpoint || !sas) {
      throw new Error(
        "Invalid AZURE_STORAGE_CONNECTION_STRING SAS format: expected BlobEndpoint and SharedAccessSignature"
      );
    }
    const base = blobEndpoint.endsWith("/") ? blobEndpoint : `${blobEndpoint}/`;
    const url = new URL(base);
    url.search = sas.startsWith("?") ? sas : `?${sas}`;
    return new BlobServiceClient(url.toString());
  }

  if (v.includes("DefaultEndpointsProtocol=") || v.includes("AccountName=")) {
    return BlobServiceClient.fromConnectionString(v);
  }

  const url = new URL(decodeURIComponent(v));
  if (url.searchParams.has("sig")) return new BlobServiceClient(url.toString());

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  if (!accountName || !accountKey) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING must be a connection string or SAS URL; otherwise set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY"
    );
  }
  const cred = new StorageSharedKeyCredential(accountName, accountKey);
  return new BlobServiceClient(url.origin, cred);
}

async function ensureContainerExists(client: BlobServiceClient): Promise<void> {
  const container = client.getContainerClient(getContainerName());
  await container.createIfNotExists();
}

async function streamToString(
  readable: NodeJS.ReadableStream | ReadableStream | null | undefined
): Promise<string> {
  if (!readable) return "";
  // @ts-expect-error runtime-dependent
  if (typeof (readable as any)[Symbol.asyncIterator] === "function") {
    const chunks: any[] = [];
    // @ts-expect-error runtime-dependent
    for await (const chunk of readable as any) chunks.push(chunk);
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  }
  if (typeof (readable as any).getReader === "function") {
    const reader = (readable as any).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    return Buffer.from(merged).toString("utf8");
  }
  return "";
}

export async function readJsonBlob<T>(params: {
  blobName: string;
}): Promise<{ json: T | null; etag?: string }> {
  const client = getBlobServiceClient();
  await ensureContainerExists(client);

  const container = client.getContainerClient(getContainerName());
  const blob = container.getBlockBlobClient(params.blobName);
  const exists = await blob.exists();
  if (!exists) return { json: null, etag: undefined };

  const download = await blob.download();
  const etag = download.etag;
  const body = await streamToString(download.readableStreamBody);
  if (!body) return { json: null, etag };
  return { json: JSON.parse(body) as T, etag };
}

export async function writeJsonBlob(params: {
  blobName: string;
  json: unknown;
  ifMatch?: string;
}): Promise<{ etag?: string }> {
  const client = getBlobServiceClient();
  await ensureContainerExists(client);

  const container = client.getContainerClient(getContainerName());
  const blob = container.getBlockBlobClient(params.blobName);

  const body = JSON.stringify(params.json);
  const conditions: BlobRequestConditions | undefined = params.ifMatch
    ? { ifMatch: params.ifMatch }
    : undefined;

  const res = await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: "application/json" },
    conditions,
  });
  return { etag: res.etag };
}
