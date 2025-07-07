import { functions } from './appwrite';

export interface FunctionExecution {
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

export async function getFunctionExecution(executionId: string): Promise<FunctionExecution> {
  try {
    // The function ID is not needed here as executionId is globally unique
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/functions/executions/${executionId}`,
      {
        headers: {
          'X-Appwrite-Project': process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
          'X-Appwrite-Key': process.env.APPWRITE_API_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch function execution');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting function execution:', error);
    throw error;
  }
}

export async function waitForFunctionCompletion(executionId: string, interval = 2000): Promise<FunctionExecution> {
  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const execution = await getFunctionExecution(executionId);
        
        if (['completed', 'failed'].includes(execution.status)) {
          resolve(execution);
          return;
        }

        // If still processing, check again after interval
        setTimeout(checkStatus, interval);
      } catch (error) {
        reject(error);
      }
    };

    // Start checking status
    checkStatus();
  });
}
