'use client';

import { useCallback, useState, useEffect } from 'react';
import { JobResponse } from '@/types/job';

const getApiUrl = (path: string) => {
  // Use NEXT_PUBLIC_SITE_URL if defined, otherwise fall back to window.location.origin for client-side
  // and default to localhost for server-side rendering
  if (typeof window !== 'undefined') {
    // Client-side: use current origin
    return `${window.location.origin}${path}`;
  }
  
  // Server-side: use environment variable or default to localhost
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return `${baseUrl}${path}`;
};

export function useJob(jobId: string) {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobById = useCallback(async (id: string): Promise<JobResponse> => {
    try {
      const url = getApiUrl(`/api/v1/jobs/${id}`);
      const res = await fetch(url, {
        cache: 'no-store', // Prevent caching
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to fetch job by ID:', {
          status: res.status,
          statusText: res.statusText,
          errorData
        });
        throw new Error(errorData.error || 'Failed to fetch job');
      }
      
      return res.json();
    } catch (error) {
      console.error('Error in fetchJobById:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchJob = async () => {
      if (!jobId) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await fetchJobById(jobId);
        if (isMounted) {
          setJob(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('An error occurred'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchJob();

    return () => {
      isMounted = false;
    };
  }, [jobId, fetchJobById]);

  return { job, error, isLoading };
}



export function useJobBySession(sessionId: string) {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobBySessionId = useCallback(async (sessionId: string): Promise<JobResponse> => {
    try {
      const url = getApiUrl(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`);
      const res = await fetch(url, {
        cache: 'no-store', // Prevent caching
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to find job:', {
          status: res.status,
          statusText: res.statusText,
          errorData
        });
        throw new Error(errorData.error || 'Failed to find job');
      }
      
      return res.json();
    } catch (error) {
      console.error('Error in fetchJobBySessionId:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchJob = async () => {
      try {
        const data = await fetchJobBySessionId(sessionId);
        if (isMounted) {
          setJob(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('An error occurred'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchJob();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  return { job, error, isLoading };
}
