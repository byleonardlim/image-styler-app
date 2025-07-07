'use client';

import { use } from 'react';
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

const fetchJob = async (jobId: string): Promise<JobResponse> => {
  const url = getApiUrl(`/api/v1/jobs/${jobId}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch job');
  return res.json();
};

export function useJob(jobId: string) {
  return use(fetchJob(jobId));
}

const fetchJobBySessionId = async (sessionId: string): Promise<JobResponse> => {
  try {
    const url = getApiUrl(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`);
    console.log('Fetching job with URL:', url);
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
};

export function useJobBySession(sessionId: string) {
  return use(fetchJobBySessionId(sessionId));
}
