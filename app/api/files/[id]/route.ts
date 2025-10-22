import { NextResponse } from 'next/server';
import { databases } from '@/lib/appwriteServer';
import { Query } from 'node-appwrite';

const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const appwriteApiKey = process.env.APPWRITE_API_KEY!;
const appwriteBucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;

export async function GET(
  _request: Request,
  { params }: any
) {
  const fileId = params.id;

  if (!fileId) {
    return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
  }

  if (!appwriteEndpoint || !appwriteProjectId || !appwriteApiKey || !appwriteBucketId) {
    return NextResponse.json({ error: 'Server is misconfigured' }, { status: 500 });
  }

  try {
    // Authorize via session ownership mapping (uploads collection)
    const cookieHeader = _request.headers.get('cookie') || '';
    const sidMatch = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
    const sid = sidMatch ? decodeURIComponent(sidMatch[1]) : '';
    if (!sid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const uploadsDbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
      const uploadsColId = process.env.NEXT_PUBLIC_APPWRITE_UPLOADS_COLLECTION_ID!;
      const res = await databases.listDocuments(
        uploadsDbId,
        uploadsColId,
        [Query.equal('file_id', fileId), Query.equal('session_id', sid), Query.limit(1)]
      );
      if (!res.documents || res.documents.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch (authErr) {
      console.error('File proxy auth check failed', authErr);
      return NextResponse.json({ error: 'Authorization failed' }, { status: 500 });
    }

    const url = new URL(`${appwriteEndpoint}/storage/buckets/${appwriteBucketId}/files/${fileId}/view`);
    url.searchParams.append('project', appwriteProjectId);

    const upstream = await fetch(url.toString(), {
      // Stream the response from Appwrite to our client
      method: 'GET',
      headers: {
        'X-Appwrite-Project': appwriteProjectId,
        'X-Appwrite-Key': appwriteApiKey,
        // Let Appwrite decide content-type; we forward below
        'Accept': '*/*',
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}: ${text || upstream.statusText}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json(
        { error: 'Unsupported media type' },
        { status: 415 }
      );
    }
    const contentLength = upstream.headers.get('content-length') || undefined;
    const cacheControl = 'private, max-age=0, must-revalidate';

    // Return a streamed response with important headers forwarded
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        'Cache-Control': cacheControl,
      },
    });
  } catch (err) {
    console.error('Proxy file view error:', err);
    return NextResponse.json({ error: 'Failed to proxy file view' }, { status: 500 });
  }
}
