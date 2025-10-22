import { NextResponse } from 'next/server';
import { storage, databases } from '@/lib/appwriteServer';
import { Query } from 'node-appwrite';
import { appwriteBucketId } from '@/lib/appwrite';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function DELETE(request: Request) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'No file ID provided' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Verify ownership via session cookie and uploads mapping
    const cookieHeader = request.headers.get('cookie') || '';
    const sidMatch = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
    const sid = sidMatch ? decodeURIComponent(sidMatch[1]) : '';
    if (!sid) {
      return NextResponse.json(
        { error: 'Unauthorized: missing session' },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      const uploadsDbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
      const uploadsColId = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_COLLECTION_ID!;
      // Look up ownership
      const res = await databases.listDocuments(
        uploadsDbId,
        uploadsColId,
        [
          Query.equal('file_id', fileId),
          Query.equal('session_id', sid),
          Query.limit(1)
        ]
      );
      const owns = (res.documents || []).length > 0;
      if (!owns) {
        return NextResponse.json(
          { error: 'Forbidden: not owner of file' },
          { status: 403, headers: corsHeaders }
        );
      }
    } catch (e) {
      console.error('Ownership check failed', e);
      return NextResponse.json(
        { error: 'Failed to authorize delete' },
        { status: 500, headers: corsHeaders }
      );
    }

    const bucketId = appwriteBucketId;
    
    // Delete the file from Appwrite Storage
    await storage.deleteFile(bucketId, fileId);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    }, {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Delete error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
