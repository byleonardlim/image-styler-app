import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwriteServer';

export async function POST(request: Request, { params }: any) {
  try {
    const jobId = params.id;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!;

    await databases.updateDocument(databaseId, collectionId, jobId, {
      is_downloaded: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to mark as downloaded' }, { status: 500 });
  }
}
