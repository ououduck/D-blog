// Cloudflare Pages Function for real-time analytics
interface Env {
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ZONE_ID: string;
}

interface CloudflareAnalyticsData {
  requests: number;
  pageViews: number;
  uniques: number;
  bandwidth: number;
}

interface CloudflareTopItem {
  path: string;
  requests: number;
  pageViews: number;
}

interface CloudflareCountryItem {
  country: string;
  requests: number;
}

interface CloudflareTimeWindow {
  days: number;
  data: CloudflareAnalyticsData;
  topPages: CloudflareTopItem[];
  topCountries: CloudflareCountryItem[];
  error: string | null;
}

interface CloudflareSnapshot {
  enabled: boolean;
  fetchedAt: string | null;
  domain: string;
  timeWindows: CloudflareTimeWindow[];
}

const fetchAnalyticsForDays = async (
  token: string,
  zoneId: string,
  days: number
): Promise<CloudflareTimeWindow> => {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  
  const sinceStr = since.toISOString().split('T')[0];
  const untilStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

  try {
    // Fetch analytics totals
    const totalsQuery = `
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

    const totalsResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: totalsQuery })
    });

    if (!totalsResponse.ok) {
      const errorText = await totalsResponse.text();
      throw new Error(`API request failed with status ${totalsResponse.status}: ${errorText}`);
    }

    const totalsData = await totalsResponse.json();
    
    if (totalsData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(totalsData.errors)}`);
    }
    
    const groups = totalsData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    
    const totals = groups.reduce((acc: CloudflareAnalyticsData, group: any) => ({
      requests: acc.requests + (group.sum?.requests || 0),
      pageViews: acc.pageViews + (group.sum?.pageViews || 0),
      bandwidth: acc.bandwidth + (group.sum?.bytes || 0),
      uniques: acc.uniques + (group.uniq?.uniques || 0)
    }), { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 });

    // 暂时返回空的 topPages 和 topCountries
    // Cloudflare GraphQL API 的 dimensions 查询需要特定的权限和配置
    const topPages: CloudflareTopItem[] = [];
    const topCountries: CloudflareCountryItem[] = [];

    return {
      days,
      data: totals,
      topPages,
      topCountries,
      error: null
    };
  } catch (error) {
    return {
      days,
      data: { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 },
      topPages: [],
      topCountries: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = env.CLOUDFLARE_ZONE_ID?.trim();

  if (!token || !zoneId) {
    return new Response(JSON.stringify({
      enabled: false,
      fetchedAt: null,
      domain: 'blog.pldduck.com',
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
    domain: 'blog.pldduck.com',
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
};
