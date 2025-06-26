import { NextResponse } from 'next/server';
import { storage } from '@/lib/appwrite';

export async function DELETE(request: Request) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'No file ID provided' },
        { status: 400 }
      );
    }

    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;
    
    // Delete the file from Appwrite Storage
    await storage.deleteFile(bucketId, fileId);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
