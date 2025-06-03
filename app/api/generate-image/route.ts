import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Allow responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Get the next pending job
    const { data: job, error: fetchError } = await supabase
      .from('image_jobs')
      .select('*')
      .eq('status', 'pending')
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!job) {
      return new Response('No pending jobs', { status: 204 });
    }

    // Update job status to processing
    await supabase
      .from('image_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // Process each image in the job
    const processedImages = await Promise.all(
      job.images.map(async (imageData: any) => {
        // Get the style prompt from environment variables
        let prompt: string;
        switch(job.style) {
          case 'ghibli':
            prompt = process.env.STYLE_PROMPT_GHIBLI!;
            break;
          case 'family-guy':
            prompt = process.env.STYLE_PROMPT_FAMILY_GUY!;
            break;
          case 'disney':
            prompt = process.env.STYLE_PROMPT_DISNEY!;
            break;
          default:
            throw new Error('Invalid style selected');
        }

        if (!prompt) {
          throw new Error('Missing environment variable for style prompt');
        }

        // Create a new File object from the stored image data
        const file = new File([Buffer.from(imageData.data)], imageData.name, { type: imageData.type });

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

        const processedImage = response.data[0];
        const base64Data = processedImage.b64_json;
        if (!base64Data) {
          throw new Error('No base64 data returned from OpenAI');
        }

        // Convert base64 to Buffer
        return Buffer.from(base64Data, 'base64');
      })
    );

    // Update job status to completed
    await supabase
      .from('image_jobs')
      .update({ 
        status: 'completed',
        processed_images: processedImages.map(buffer => buffer.toString('base64'))
      })
      .eq('id', job.id);

    return new Response('Job processed successfully', { status: 200 });
  } catch (error) {
    console.error('Error processing job:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to process job' },
      { status: 500 }
    );
  }
}
