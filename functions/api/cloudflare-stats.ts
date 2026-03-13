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
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];
  const untilStr = new Date().toISOString().split('T')[0];

  try {
    // Fetch analytics totals
    const totalsQuery = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              limit: 1
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
      throw new Error(`API request failed with status ${totalsResponse.status}`);
    }

    const totalsData = await totalsResponse.json();
    const groups = totalsData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    
    const totals = groups.reduce((acc: CloudflareAnalyticsData, group: any) => ({
      requests: acc.requests + (group.sum?.requests || 0),
      pageViews: acc.pageViews + (group.sum?.pageViews || 0),
      bandwidth: acc.bandwidth + (group.sum?.bytes || 0),
      uniques: acc.uniques + (group.uniq?.uniques || 0)
    }), { requests: 0, pageViews: 0, bandwidth: 0, uniques: 0 });

    // Fetch top pages
    const pagesQuery = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              limit: 10000
              filter: { date_geq: "${sinceStr}", date_lt: "${untilStr}" }
              orderBy: [sum_requests_DESC]
            ) {
              dimensions {
                clientRequestPath
              }
              sum {
                requests
                pageViews
              }
            }
          }
        }
      }
    `;

    const pagesResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: pagesQuery })
    });

    const pagesData = await pagesResponse.json();
    const pagesGroups = pagesData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    
    const pathMap = new Map<string, { requests: number; pageViews: number }>();
    pagesGroups.forEach((group: any) => {
      const path = group.dimensions?.clientRequestPath || '/';
      const existing = pathMap.get(path) || { requests: 0, pageViews: 0 };
      pathMap.set(path, {
        requests: existing.requests + (group.sum?.requests || 0),
        pageViews: existing.pageViews + (group.sum?.pageViews || 0)
      });
    });

    const topPages = Array.from(pathMap.entries())
      .map(([path, data]) => ({ path, ...data }))
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 20);

    // Fetch top countries
    const countriesQuery = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              limit: 10000
              filter: { date_geq: "${sinceStr}", date_lt: "${untilStr}" }
              orderBy: [sum_requests_DESC]
            ) {
              dimensions {
                clientCountryName
              }
              sum {
                requests
              }
            }
          }
        }
      }
    `;

    const countriesResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: countriesQuery })
    });

    const countriesData = await countriesResponse.json();
    const countriesGroups = countriesData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    
    const countryMap = new Map<string, number>();
    countriesGroups.forEach((group: any) => {
      const country = group.dimensions?.clientCountryName || 'Unknown';
      const existing = countryMap.get(country) || 0;
      countryMap.set(country, existing + (group.sum?.requests || 0));
    });

    const topCountries = Array.from(countryMap.entries())
      .map(([country, requests]) => ({ country, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20);

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
        'Cache-Control': 'public, max-age=300' // 5分钟缓存
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
  
  // 并行获取所有时间窗口的数据
  const results = await Promise.all(
    timeWindows.map(days => fetchAnalyticsForDays(token, zoneId, days))
  );
  
  snapshot.timeWindows = results;

  return new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5分钟缓存
      'Access-Control-Allow-Origin': '*'
    }
  });
};
