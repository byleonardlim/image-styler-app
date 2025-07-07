import { functions } from './appwrite';

export async function triggerStyleTransfer(jobId: string, imageUrls: string[], style: string): Promise<string> {
  try {
    // Get the function ID from environment variables
    const functionId = process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_ID;
    if (!functionId) {
      throw new Error('Appwrite Function ID is not configured');
    }

    const endpoint = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/functions/${functionId}/executions`;
    
    // Log the request for debugging
    console.log('Triggering function at:', endpoint);
    console.log('With data:', { jobId, imageUrls, style });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
        'X-Appwrite-Key': process.env.APPWRITE_API_KEY!,
      },
      body: JSON.stringify({
        data: JSON.stringify({
          jobId,
          imageUrls,
          style,
          // Add any other necessary data for the function
        })
      }),
    });

    const responseText = await response.text();
    let result;
    
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseText);
      throw new Error(`Invalid response from server: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      console.error('Function execution failed:', {
        status: response.status,
        statusText: response.statusText,
        response: result,
      });
      throw new Error(result.message || `Failed to trigger function: ${response.status} ${response.statusText}`);
    }

    if (!result.$id) {
      console.error('Invalid response format:', result);
      throw new Error('Invalid response format from Appwrite function');
    }

    console.log('Successfully triggered function execution:', result.$id);
    return result.$id;
  } catch (error) {
    console.error('Error triggering function:', error);
    throw new Error(`Failed to trigger function: ${error instanceof Error ? error.message : String(error)}`);
  }
}
