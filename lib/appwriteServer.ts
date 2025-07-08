import { Client, Account, Storage, Databases, Functions } from 'node-appwrite';

const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const appwriteApiKey = process.env.APPWRITE_API_KEY!;

if (!appwriteEndpoint || !appwriteProjectId || !appwriteApiKey) {
  throw new Error('Missing Appwrite server environment variables');
}

// Create a server client with admin privileges
const client = new Client()
  .setEndpoint(appwriteEndpoint)
  .setProject(appwriteProjectId)
  .setKey(appwriteApiKey);

// Initialize services
export const account = new Account(client);
export const storage = new Storage(client);
export const databases = new Databases(client);
export const functions = new Functions(client);
