
// public/polling-worker.js

let pollInterval;
let jobId;
let attempt = 0;
const MAX_ATTEMPTS = 360; // 30 minutes total
const POLL_INTERVAL = 5 * 1000; // 5 seconds

self.onmessage = function(e) {
  if (e.data.command === 'start') {
    jobId = e.data.jobId;
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(poll, POLL_INTERVAL);
    attempt = 0; // Reset attempt count on start
  } else if (e.data.command === 'stop') {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

async function poll() {
  if (attempt >= MAX_ATTEMPTS) {
    self.postMessage({ type: 'error', payload: "Job processing is taking longer than expected. We'll notify you by email when it's ready." });
    clearInterval(pollInterval);
    return;
  }

  try {
    const response = await fetch(`/api/v1/jobs/${jobId}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Job ${jobId} not found, will retry...`);
        // Don't throw an error, just continue polling
        return;
      }
      const errorData = await response.json().catch(() => ({ error: 'An unexpected error occurred' }));
      throw new Error(errorData.error || `Failed to fetch job status: ${response.status}`);
    }

    const jobData = await response.json();
    self.postMessage({ type: 'data', payload: jobData });

    const isJobFinished = (jobData.status === 'completed' && Array.isArray(jobData.imageUrls) && jobData.imageUrls.length > 0) || jobData.status === 'failed';

    if (isJobFinished) {
      clearInterval(pollInterval);
    }
  } catch (error) {
    self.postMessage({ type: 'error', payload: error.message });
    clearInterval(pollInterval);
  } finally {
    attempt++;
  }
}
