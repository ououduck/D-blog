interface CloudflareAnalyticsData {
  requests: number;
  pageViews: number;
  uniques: number;
  bandwidth: number;
}

interface CloudflareTimeWindow {
  days: number;
  data: CloudflareAnalyticsData;
  error: string | null;
}

interface CloudflareSnapshot {
  enabled: boolean;
  fetchedAt: string | null;
  domain: string;
  timeWindows: CloudflareTimeWindow[];
}

interface CloudflareGroup {
  sum?: {
    requests?: number;
    pageViews?: number;
    bytes?: number;
  };
  uniq?: {
    uniques?: number;
  };
}

interface CloudflareRequestContext {
  env: {
    CLOUDFLARE_API_TOKEN?: string;
    CLOUDFLARE_ZONE_ID?: string;
  };
}

const fetchAnalyticsForDays = async (
  token: string,
  zoneId: string,
  days: number
): Promise<CloudflareTimeWindow> => {
  try {
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - days);
    
    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              limit: ${days + 1}
              filter: { date_geq: "${sinceStr}", date_lt: "${untilStr}" }
            ) {
              sum {
                requests
                pageViews
                bytes
              }
              uniq {
                uniques
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const groups = (data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []) as CloudflareGroup[];
    
    const totals = groups.reduce((acc: CloudflareAnalyticsData, group) => ({
      requests: acc.requests + (group.sum?.requests || 0),
      pageViews: acc.pageViews + (group.sum?.pageViews || 0),
      bandwidth: acc.bandwidth + (group.sum?.bytes || 0),
      uniques: acc.uniques + (group.uniq?.uniques || 0)
    }), { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 });

    return {
      days,
      data: totals,
      error: null
    };
  } catch (error) {
    return {
      days,
      data: { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export async function onRequest(context: CloudflareRequestContext) {
  const { env } = context;
  
  const token = env.CLOUDFLARE_API_TOKEN?.replace(/\s+/g, '');
  const zoneId = env.CLOUDFLARE_ZONE_ID?.replace(/\s+/g, '');

  if (!token || !zoneId) {
    return new Response(JSON.stringify({
      enabled: false,
      fetchedAt: null,
      domain: 'pldduck.com',
      timeWindows: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }

  const snapshot: CloudflareSnapshot = {
    enabled: true,
    fetchedAt: new Date().toISOString(),
    domain: 'pldduck.com',
    timeWindows: []
  };

  const timeWindows = [1, 7, 30];
  
  const results = await Promise.all(
    timeWindows.map(days => fetchAnalyticsForDays(token, zoneId, days))
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
