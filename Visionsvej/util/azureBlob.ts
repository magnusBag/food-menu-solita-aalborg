import { BlobServiceClient } from "npm:@azure/storage-blob@12.16.0";
import { Buffer } from "node:buffer";
import { DayMenu } from "./models.ts";

export async function uploadToBlobStorage(
    content: DayMenu[],
    blobName: string,
    containerName = "weekly-food-menu",
): Promise<void> {
    const blobServiceClient = new BlobServiceClient(
        Deno.env.get("AZURE_STORAGE_CONNECTION_STRING") || "",
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(JSON.stringify(content), content.length);
}

export async function getDataFromBlobStorage(
    blobName: string,
): Promise<DayMenu[] | null> {
    const connectionString = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
    if (!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
    }
    const blobServiceClient = new BlobServiceClient(connectionString);
    const containerClient = blobServiceClient.getContainerClient(
        "weekly-food-menu",
    );
    const blobClient = containerClient.getBlobClient(blobName);
    try {
        const downloadResponse = await blobClient.download(0);
        if (!downloadResponse.readableStreamBody) {
            return null;
        }
        const chunks: (string | Buffer)[] = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
            chunks.push(chunk);
        }
        let jsonString: string;
        if (typeof chunks[0] === "string") {
            jsonString = chunks.join("");
        } else {
            jsonString = new TextDecoder().decode(
                Buffer.concat(chunks as Buffer[]),
            );
        }
        return JSON.parse(jsonString);
    } catch {
        return null;
    }
}
