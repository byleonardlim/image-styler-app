import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwriteServer';
import { Query } from 'node-appwrite';
import crypto from 'crypto';

// Expect env var for claims collection
// NEXT_PUBLIC_APPWRITE_CLAIMS_COLLECTION_ID

export async function POST(request: Request, { params }: any) {
  try {
    const jobId = params.id as string | undefined;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const { claimToken, appwriteUserId } = await request.json();
    if (!claimToken || typeof claimToken !== 'string') {
      return NextResponse.json({ error: 'Missing claim token' }, { status: 400 });
    }
    if (!appwriteUserId || typeof appwriteUserId !== 'string') {
      return NextResponse.json({ error: 'Missing appwriteUserId' }, { status: 400 });
    }

    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const claimsColId = process.env.NEXT_PUBLIC_APPWRITE_CLAIMS_COLLECTION_ID!;
    const jobsColId = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!;

    // Hash incoming token to compare (hex sha256)
    const tokenHash = crypto.createHash('sha256').update(claimToken, 'utf8').digest('hex');

    // Lookup claim record by job and token hash
    const res = await databases.listDocuments(dbId, claimsColId, [
      Query.equal('job_id', jobId),
      Query.equal('token_hash', tokenHash),
      Query.equal('used', false),
      Query.limit(1)
    ]);

    if (!res.documents || res.documents.length === 0) {
      return NextResponse.json({ error: 'Invalid or used token' }, { status: 400 });
    }
    const claimDoc = res.documents[0] as any;
    if (claimDoc.expires_at && new Date(claimDoc.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    // Get current permissions from the job document (so we can append)
    const jobDoc = await databases.getDocument(dbId, jobsColId, jobId) as any;
    const currentPerms: string[] = Array.isArray(jobDoc.$permissions) ? jobDoc.$permissions : [];

    const newRead = `read("user:${appwriteUserId}")`;
    const nextPerms = Array.from(new Set([...
      currentPerms,
      newRead
    ]));

    // Update job document permissions
    await databases.updateDocument(dbId, jobsColId, jobId, {}, nextPerms);

    // Mark claim as used
    await databases.updateDocument(dbId, claimsColId, claimDoc.$id, { used: true, used_at: new Date().toISOString() });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Claim error:', err);
    return NextResponse.json({ error: 'Failed to claim access' }, { status: 500 });
  }
}
