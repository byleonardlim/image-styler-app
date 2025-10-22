import { Client, Account } from 'appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;

let client: Client | null = null;
let account: Account | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client().setEndpoint(endpoint).setProject(project);
  }
  return client;
}

export function getAccount(): Account {
  if (!account) account = new Account(getClient());
  return account;
}

export function getAppwriteClient(): Client { return getClient(); }

export async function getOrCreateAnonymousUserId(): Promise<string> {
  // Cache in localStorage to avoid extra roundtrips
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('appwrite_user_id');
    if (cached) return cached;
  }

  const acc = getAccount();
  try {
    const me = await acc.get();
    if (typeof window !== 'undefined') localStorage.setItem('appwrite_user_id', me.$id);
    return me.$id;
  } catch {
    // no session, create anonymous
    await acc.createAnonymousSession();
    const me = await acc.get();
    if (typeof window !== 'undefined') localStorage.setItem('appwrite_user_id', me.$id);
    return me.$id;
  }
}
