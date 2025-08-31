import { ID } from 'node-appwrite';

const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
export const appwriteBucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;

export { ID };

export function getFilePreviewUrl(bucketId: string, fileId: string, width?: number, height?: number): string {
  const url = new URL(`${appwriteEndpoint}/storage/buckets/${bucketId}/files/${fileId}/preview`);
  url.searchParams.append('project', appwriteProjectId);
  if (width) url.searchParams.append('width', width.toString());
  if (height) url.searchParams.append('height', height.toString());
  return url.toString();
}

export function getFileViewUrl(bucketId: string, fileId: string): string {
  const url = new URL(`${appwriteEndpoint}/storage/buckets/${bucketId}/files/${fileId}/view`);
  url.searchParams.append('project', appwriteProjectId);
  return url.toString();
}
