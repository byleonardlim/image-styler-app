import { NextResponse } from 'next/server';
import { storage } from '@/lib/appwriteServer';
import { getFilePreviewUrl, getFileViewUrl, appwriteBucketId } from '@/lib/appwrite';
import { ID } from 'node-appwrite';

// Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: Request) {
  try {
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

    const bucketId = appwriteBucketId;
    
    // Upload to Appwrite Storage
    const result = await storage.createFile(
      bucketId,
      ID.unique(),
      file, // Directly use the file object
    );

    // Return the response with CORS headers
    return NextResponse.json({
      fileId: result.$id,
      fileUrl: getFileViewUrl(bucketId, result.$id),
      previewUrl: getFilePreviewUrl(bucketId, result.$id, 800),
      name: file.name,
      size: file.size,
      type: file.type,
    }, {
      headers: corsHeaders
    });
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
