
"use client";

import { useState, useEffect } from 'react';

// Types
import { JobResponse } from '@/types/job';

interface UsePollJobStatusReturn {
  job: JobResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to poll for job status updates using a Web Worker.
 * @param jobId The ID of the job to poll.
 */
export function usePollJobStatus(jobId: string | null): UsePollJobStatusReturn {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setIsLoading(false);
      return;
    }

    const worker = new Worker('/polling-worker.js');

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'data') {
        setJob(payload);
        const isJobFinished = payload.status === 'completed' || payload.status === 'failed';
        if (isJobFinished) {
          setIsLoading(false);
          if (payload.status === 'failed') {
            setError(payload.error || 'Job processing failed.');
          }
          worker.postMessage({ command: 'stop' });
        }
      } else if (type === 'error') {
        setError(payload);
        setIsLoading(false);
      }
    };

    worker.postMessage({ command: 'start', jobId });

    return () => {
      worker.postMessage({ command: 'stop' });
      worker.terminate();
    };
  }, [jobId]);

  const isEffectivelyLoading = isLoading && !error;

  return { job, isLoading: isEffectivelyLoading, error };
}
