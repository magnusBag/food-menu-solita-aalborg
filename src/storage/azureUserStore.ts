import { readJsonBlob, writeJsonBlob } from "./azureRawBlob";

export type UserRecord = {
  cookie: string;
  score: number;
  userName: string;
};

type UsersEnvelopeV1 = {
  version: 1;
  updatedAt: string;
  users: Record<string, UserRecord>;
};

const USERS_BLOB_NAME = "users.json";

async function writeUsersBlob(params: {
  users: Record<string, UserRecord>;
  ifMatch?: string;
}): Promise<{ etag?: string }> {
  const envelope: UsersEnvelopeV1 = {
    version: 1,
    updatedAt: new Date().toISOString(),
    users: params.users,
  };

  return await writeJsonBlob({
    blobName: USERS_BLOB_NAME,
    json: envelope,
    ifMatch: params.ifMatch,
  });
}

export async function getOrCreateUser(cookie: string): Promise<UserRecord> {
  const { users, etag } = await getAllUsers();
  const existing = users[cookie];
  if (existing) return existing;

  const created: UserRecord = { cookie, score: 0, userName: "Guest" };
  const next = { ...users, [cookie]: created };
  await writeUsersBlob({ users: next, ifMatch: etag });
  return created;
}

export async function getAllUsers(): Promise<{ users: Record<string, UserRecord>; etag?: string }> {
  const res = await readJsonBlob<UsersEnvelopeV1>({ blobName: USERS_BLOB_NAME });
  if (!res.json) return { users: {}, etag: res.etag };
  return { users: res.json.users || {}, etag: res.etag };
}

export async function updateUser(
  cookie: string,
  updater: (u: UserRecord) => UserRecord
): Promise<UserRecord> {
  while (true) {
    const { users, etag } = await getAllUsers();
    const current = users[cookie] || { cookie, score: 0, userName: "Guest" };
    const updated = updater(current);
    const next = { ...users, [cookie]: updated };
    try {
      await writeUsersBlob({ users: next, ifMatch: etag });
      return updated;
    } catch (e: any) {
      // If ETag mismatch, retry.
      if (e?.statusCode === 412) continue;
      throw e;
    }
  }
}
