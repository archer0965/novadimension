import { del, get, list, put } from "@vercel/blob";

export type GenerationRecord = {
  id: string;
  accountId: string;
  outputUrl: string;
  style: string;
  roomType: string;
  styleLabel?: string;
  roomLabel?: string;
  createdAt: string;
};

const PREFIX = "generations/";

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function itemPath(accountId: string, id: string) {
  return `${PREFIX}${accountId}/${id}.json`;
}

async function readBlobText(
  pathname: string,
  token: string,
): Promise<string | null> {
  try {
    const result = await get(pathname, {
      access: "private",
      token,
    });
    if (!result?.stream) return null;
    return await new Response(result.stream).text();
  } catch {
    return null;
  }
}

export async function listGenerations(
  accountId: string,
  limit = 40,
): Promise<GenerationRecord[]> {
  const token = blobToken();
  if (!token || !accountId) return [];

  try {
    const listed = await list({
      prefix: `${PREFIX}${accountId}/`,
      token,
    });

    const items: GenerationRecord[] = [];
    for (const blob of listed.blobs) {
      const text = await readBlobText(blob.pathname, token);
      if (!text) continue;
      try {
        const item = JSON.parse(text) as GenerationRecord;
        if (item?.id && item?.outputUrl) {
          items.push(item);
        }
      } catch {
        // skip invalid
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return items.slice(0, limit);
  } catch {
    return [];
  }
}

export async function saveGeneration(
  input: Omit<GenerationRecord, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<GenerationRecord> {
  const token = blobToken();
  const record: GenerationRecord = {
    id:
      input.id ||
      `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: input.accountId,
    outputUrl: input.outputUrl,
    style: input.style,
    roomType: input.roomType,
    styleLabel: input.styleLabel,
    roomLabel: input.roomLabel,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  if (!token) return record;

  await put(itemPath(record.accountId, record.id), JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token,
    cacheControlMaxAge: 0,
  });

  return record;
}

export async function deleteGeneration(
  accountId: string,
  id: string,
): Promise<boolean> {
  const token = blobToken();
  if (!token || !accountId || !id) return false;

  try {
    await del(itemPath(accountId, id), { token });
    return true;
  } catch {
    return false;
  }
}
