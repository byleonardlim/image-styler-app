import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Allow responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Process images directly from request
    const { images, style } = await req.json();
    if (!images || !style) {
      return Response.json(
        { error: 'Missing images or style parameter' },
        { status: 400 }
      );
    }

    // Process each image
    const processedImages = await Promise.all(
      images.map(async (image: string) => {
        try {
          const generateResponse = await openai.images.generate({
            prompt: `Style this image in ${style} style`,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
          });

          if (!generateResponse.data || generateResponse.data.length === 0) {
            throw new Error('No image data returned from OpenAI');
          }

          const base64Data = generateResponse.data[0].b64_json;
          if (!base64Data) {
            throw new Error('No base64 data returned from OpenAI');
          }
          return Buffer.from(base64Data, 'base64');
        } catch (error) {
          console.error('Error processing image:', error);
          throw error;
        }
      })
    );

    return Response.json({
      processed_images: processedImages.map((buffer: Buffer) => buffer.toString('base64'))
    });
  } catch (error) {
    console.error('Error processing images:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to process images' },
      { status: 500 }
    );
  }
}
