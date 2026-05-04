interface UmamiAnalyticsData {
  visitors: number;
  visits: number;
  pageviews: number;
}

interface UmamiTimeWindow {
  days: number;
  data: UmamiAnalyticsData;
  error: string | null;
}

interface UmamiSnapshot {
  enabled: boolean;
  fetchedAt: string | null;
  websiteId: string;
  timeWindows: UmamiTimeWindow[];
}

interface UmamiRequestContext {
  env: {
    UMAMI_API_URL?: string;
    UMAMI_API_KEY?: string;
    UMAMI_WEBSITE_ID?: string;
  };
}

interface UmamiStatsResponse {
  pageviews: { value: number };
  visitors: { value: number };
  visits: { value: number };
}

const fetchAnalyticsForDays = async (
  apiUrl: string,
  apiKey: string,
  websiteId: string,
  days: number
): Promise<UmamiTimeWindow> => {
  try {
    const now = new Date();
    const startAt = new Date(now);
    startAt.setDate(startAt.getDate() - days);
    
    const startAtMs = startAt.getTime();
    const endAtMs = now.getTime();

    const url = `https://${apiUrl}/api/websites/${websiteId}/stats?startAt=${startAtMs}&endAt=${endAtMs}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-umami-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json() as UmamiStatsResponse;
    
    return {
      days,
      data: {
        pageviews: data.pageviews?.value || 0,
        visitors: data.visitors?.value || 0,
        visits: data.visits?.value || 0
      },
      error: null
    };
  } catch (error) {
    return {
      days,
      data: { pageviews: 0, visitors: 0, visits: 0 },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export async function onRequest(context: UmamiRequestContext) {
  const { env } = context;
  
  const apiUrl = env.UMAMI_API_URL?.replace(/\s+/g, '') || 'api.umami.is';
  const apiKey = env.UMAMI_API_KEY?.replace(/\s+/g, '');
  const websiteId = env.UMAMI_WEBSITE_ID?.replace(/\s+/g, '');

  if (!apiKey || !websiteId) {
    return new Response(JSON.stringify({
      enabled: false,
      fetchedAt: null,
      websiteId: '',
      timeWindows: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }

  const snapshot: UmamiSnapshot = {
    enabled: true,
    fetchedAt: new Date().toISOString(),
    websiteId: websiteId,
    timeWindows: []
  };

  const timeWindows = [1, 7, 30];
  
  const results = await Promise.all(
    timeWindows.map(days => fetchAnalyticsForDays(apiUrl, apiKey, websiteId, days))
  );
  
  snapshot.timeWindows = results;

  return new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
