import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Allow responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    const imageFile = formData.get('image') as File;

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!imageFile) {
      return Response.json({ error: 'Image file is required' }, { status: 400 });
    }

    // Validate file type - support common web image formats
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      return Response.json({ 
        error: 'Only JPEG, PNG, and WebP images are supported. Please convert your image to one of these formats.' 
      }, { status: 400 });
    }

    // Create a new File object with the correct type
    const file = new File([imageFile], imageFile.name, { type: 'image/png' });

    // Make the API call with b64_json format
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt,
      size: 'auto',
      n: 1,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI');
    }

    const image = response.data[0];
    const base64Data = image.b64_json;
    if (!base64Data) {
      throw new Error('No base64 data returned from OpenAI');
    }

    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error editing image:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to edit image' },
      { status: 500 }
    );
  }
}
