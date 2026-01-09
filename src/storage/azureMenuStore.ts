import type { MenuItem } from "../models/menuItem";
import { readJsonBlob, writeJsonBlob } from "./azureRawBlob";

type MenuEnvelopeV1 = {
  version: 1;
  updatedAt: string;
  items: MenuItem[];
};

const DEFAULT_BLOB_NAME = "menu.json";

function getBlobName(): string {
  return process.env.MENU_BLOB_NAME || DEFAULT_BLOB_NAME;
}

export async function readMenuFromBlob(): Promise<{
  items: MenuItem[];
  etag?: string;
}> {
  const res = await readJsonBlob<MenuEnvelopeV1 | MenuItem[]>({
    blobName: getBlobName(),
  });
  if (!res.json) return { items: [], etag: res.etag };
  const parsed = res.json;
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  return { items, etag: res.etag };
}

export async function writeMenuToBlob(params: {
  items: MenuItem[];
  ifMatch?: string;
}): Promise<{ etag?: string }> {
  const envelope: MenuEnvelopeV1 = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: params.items,
  };
  return await writeJsonBlob({
    blobName: getBlobName(),
    json: envelope,
    ifMatch: params.ifMatch,
  });
}
