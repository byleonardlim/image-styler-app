'use client';

import { use } from 'react';
import { JobResponse } from '@/types/job';

const fetchJob = async (jobId: string): Promise<JobResponse> => {
  const res = await fetch(`/api/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job');
  return res.json();
};

export function useJob(jobId: string) {
  return use(fetchJob(jobId));
}

const fetchJobBySessionId = async (sessionId: string): Promise<JobResponse> => {
  const res = await fetch(`/api/jobs?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Failed to find job');
  return res.json();
};

export function useJobBySession(sessionId: string) {
  return use(fetchJobBySessionId(sessionId));
}
