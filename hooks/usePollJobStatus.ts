
"use client";

import { useState, useEffect } from 'react';
import { getAppwriteClient, getOrCreateAnonymousUserId } from '@/lib/appwriteClient';

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

    let unsubscribe: (() => void) | null = null;
    let worker: Worker | null = null;
    let fallbackTimer: any = null;

    const startPollingWorker = () => {
      if (worker) return;
      worker = new Worker('/polling-worker.js');
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
            worker?.postMessage({ command: 'stop' });
          }
        } else if (type === 'error') {
          setError(payload);
          setIsLoading(false);
        }
      };
      worker.postMessage({ command: 'start', jobId });
    };

    const subscribeRealtime = async () => {
      try {
        await getOrCreateAnonymousUserId();
        const client = getAppwriteClient();
        // Subscribe to this job document updates
        const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
        const colId = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID!;
        const channel = `databases.${dbId}.collections.${colId}.documents.${jobId}`;

        // Set a short fallback in case no updates come in (job might already be completed)
        fallbackTimer = setTimeout(() => {
          // Fetch once, and if still not done, start worker
          fetch(`/api/v1/jobs/${jobId}`)
            .then(r => r.ok ? r.json() : Promise.reject('failed'))
            .then((data) => {
              if (data && !('error' in data)) {
                setJob(data);
                const done = data.status === 'completed' || data.status === 'failed';
                if (done) {
                  setIsLoading(false);
                  if (data.status === 'failed') setError(data.error || 'Job processing failed.');
                } else {
                  startPollingWorker();
                }
              } else {
                startPollingWorker();
              }
            })
            .catch(() => startPollingWorker());
        }, 3000);

        unsubscribe = client.subscribe(channel, async (_event) => {
          // On any change, fetch the canonical API representation
          try {
            const resp = await fetch(`/api/v1/jobs/${jobId}`);
            if (!resp.ok) return;
            const data = await resp.json();
            setJob(data);
            const done = data.status === 'completed' || data.status === 'failed';
            if (done) {
              setIsLoading(false);
              if (data.status === 'failed') setError(data.error || 'Job processing failed.');
              // If a worker is running, stop it
              if (worker) {
                worker.postMessage({ command: 'stop' });
              }
            }
          } catch {
            // ignore transient errors; worker fallback may handle
          }
        });
      } catch {
        // If subscription fails (permissions, network, etc.), fallback to worker
        startPollingWorker();
      }
    };

    subscribeRealtime();

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (unsubscribe) unsubscribe();
      if (worker) {
        worker.postMessage({ command: 'stop' });
        worker.terminate();
      }
    };
  }, [jobId]);

  const isEffectivelyLoading = isLoading && !error;

  return { job, isLoading: isEffectivelyLoading, error };
}
