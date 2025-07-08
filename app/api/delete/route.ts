import { NextResponse } from 'next/server';
import { storage } from '@/lib/appwriteServer';
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
