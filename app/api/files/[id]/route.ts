import { NextResponse } from 'next/server';

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
