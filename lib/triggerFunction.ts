import { functions } from './appwriteServer';

export async function triggerStyleTransfer(jobId: string, imageUrls: string[], style: string): Promise<string> {
  try {
    const functionId = process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_ID;
    if (!functionId) {
      throw new Error('Appwrite Function ID is not configured');
    }

    const data = {
      jobId,
      imageUrls,
      style,
    };

    const execution = await functions.createExecution(
      functionId,
      JSON.stringify(data) // Input is a string
    );

    if (!execution.$id) {
      throw new Error('Invalid response format from Appwrite function execution');
    }

    console.log('Successfully triggered function execution:', execution.$id);
    return execution.$id;
  } catch (error) {
    console.error('Error triggering function:', error);
    throw new Error(`Failed to trigger function: ${error instanceof Error ? error.message : String(error)}`);
  }
}
