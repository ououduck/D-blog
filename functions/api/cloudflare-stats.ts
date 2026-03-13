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
  try {
    // 方法 1: 尝试使用 Analytics Dashboard API
    const sinceMinutes = days * 1440;
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/analytics/dashboard?since=-${sinceMinutes}&until=0&continuous=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // 如果是认证错误，尝试使用 X-Auth-Key 方式（如果用户提供的是 Global API Key）
      if (response.status === 400 || response.status === 403) {
        throw new Error(`Authentication failed. Please check: 1) API Token has 'Zone.Analytics:Read' permission 2) Zone ID is correct 3) Token is not expired. Error: ${errorText}`);
      }
      
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API returned error: ${JSON.stringify(data.errors)}`);
    }

    const result = data.result;
    const totals = result?.totals || {};

    return {
      days,
      data: {
        requests: totals.requests?.all || 0,
        pageViews: totals.pageviews?.all || 0,
        uniques: totals.uniques?.all || 0,
        bandwidth: totals.bandwidth?.all || 0
      },
      topPages: [],
      topCountries: [],
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
  
  // 清理 Token 和 Zone ID，移除所有空白字符
  const token = env.CLOUDFLARE_API_TOKEN?.replace(/\s+/g, '');
  const zoneId = env.CLOUDFLARE_ZONE_ID?.replace(/\s+/g, '');

  if (!token || !zoneId) {
    return new Response(JSON.stringify({
      enabled: false,
      fetchedAt: null,
      domain: 'blog.pldduck.com',
      timeWindows: [],
      error: 'Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }

  // 验证 Token 格式（Cloudflare API Token 通常是 40 个字符）
  if (token.length < 20) {
    return new Response(JSON.stringify({
      enabled: false,
      fetchedAt: null,
      domain: 'blog.pldduck.com',
      timeWindows: [],
      error: 'Invalid API token format'
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
