import { NextResponse } from 'next/server';
import { storage, databases } from '@/lib/appwriteServer';
import { getFilePreviewUrl, getFileViewUrl, appwriteBucketId } from '@/lib/appwrite';
import { ID } from 'node-appwrite';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
    // Retrieve or create a lightweight session ID from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const sidMatch = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
    let sid = sidMatch ? decodeURIComponent(sidMatch[1]) : '';
    if (!sid) {
      // generate a simple session id
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Validate type and size server-side
    if (!VALID_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Only JPEG, PNG, or WEBP are allowed.' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image file size exceeds 10MB limit' },
        { status: 400, headers: corsHeaders }
      );
    }

    const bucketId = appwriteBucketId;
    
    // Upload to Appwrite Storage
    const result = await storage.createFile(
      bucketId,
      ID.unique(),
      file, // Directly use the file object
    );

    // Record ownership in uploads collection (fileId -> sid)
    try {
      const uploadsDbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
      const uploadsColId = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_COLLECTION_ID!;
      await databases.createDocument(
        uploadsDbId,
        uploadsColId,
        ID.unique(),
        { file_id: result.$id, session_id: sid, created_at: new Date().toISOString() }
      );
    } catch (e) {
      // If mapping fails, still proceed but log server-side
      console.error('Failed to record upload ownership', e);
    }

    // Return the response with CORS headers and ensure sid cookie is set
    const res = NextResponse.json({
      fileId: result.$id,
      fileUrl: `/api/files/${result.$id}`,
      previewUrl: getFilePreviewUrl(bucketId, result.$id, 800),
      name: file.name,
      size: file.size,
      type: file.type,
    }, { headers: corsHeaders });
    // Set sid cookie if not present
    res.headers.append('Set-Cookie', `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return res;
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
