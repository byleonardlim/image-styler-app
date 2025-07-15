import { functions } from './appwriteServer';
import { Models, ExecutionMethod } from 'node-appwrite';

// Define the Execution type based on Appwrite's Models.Execution
type AppwriteExecution = Models.Execution & {
  response?: string;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
  stdout?: string;
  stderr?: string;
  time?: number;
  errors?: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
};

// Define the ExecutionList type for the listExecutions response
type ExecutionList = {
  total: number;
  executions: AppwriteExecution[];
};

export async function triggerStyleTransfer(jobId: string, imageUrls: string[], styleName: string): Promise<string> {
  try {
    const functionId = process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_ID;
    
    if (!functionId) {
      throw new Error('NEXT_PUBLIC_APPWRITE_FUNCTION_ID is not set');
    }

    // Check for existing execution first
    const existingExecution = await getExistingExecution(jobId, functionId);
    if (existingExecution) {
      console.log(`Found existing execution for job ${jobId}: ${existingExecution.$id} (status: ${existingExecution.status})`);
      return existingExecution.$id;
    }

    const data = {
      jobId,
      imageUrls,
      styleName,
      timestamp: new Date().toISOString(),
    };

    console.log(`Triggering style transfer for job ${jobId}`);
    const execution = await functions.createExecution(
      functionId,
      JSON.stringify(data),
      true, // async
      undefined, // xpath
ExecutionMethod.POST, // method
      { 'Content-Type': 'application/json' } // headers
    ) as unknown as AppwriteExecution;

    if (!execution?.$id) {
      throw new Error('Failed to get execution ID from Appwrite');
    }

    console.log(`Created execution ${execution.$id} for job ${jobId}`);
    return execution.$id;
  } catch (error) {
    console.error('Error triggering function:', error);
    throw new Error(`Failed to trigger function: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface FunctionExecution {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  functionId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  statusCode: number;
  response: string;
  stdout: string;
  stderr: string;
  duration: number;
}

async function getExistingExecution(jobId: string, functionId: string): Promise<AppwriteExecution | null> {
  try {
    // List all executions for this function and search for the jobId in the response
    const response = await functions.listExecutions(functionId, [
      `equal("status", ["waiting", "processing", "completed"])`,
      `search("${jobId}", ["response"])`,
      `limit(1)`
    ]) as unknown as ExecutionList;
    
    // Return the first matching execution if found
    return response.executions[0] || null;
  } catch (error) {
    console.error('Error checking for existing execution:', error);
    // If we can't check, assume no existing execution
    return null;
  }
}
