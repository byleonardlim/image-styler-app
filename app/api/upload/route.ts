import { NextResponse } from 'next/server';
import { storage } from '@/lib/appwrite';
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

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create a File object with the buffer
    const fileObj = new File([buffer], file.name, { 
      type: file.type,
      lastModified: file.lastModified 
    });

    const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;
    
    // Upload to Appwrite Storage
    const result = await storage.createFile(
      bucketId,
      ID.unique(),
      fileObj
    );

    // Get the file URL - Use the Appwrite CDN URL for public access
    const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${result.$id}/preview?width=800&project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

    // Return the response with CORS headers
    return NextResponse.json({
      fileId: result.$id,
      fileUrl: `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${result.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`,
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
