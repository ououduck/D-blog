// Vite插件：在开发环境模拟Cloudflare Pages Functions
import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function cloudflareApiMock(): Plugin {
  return {
    name: 'cloudflare-api-mock',
    configureServer(server) {
      server.middlewares.use('/api/cloudflare-stats', async (req, res) => {
        // 在开发环境中，尝试读取生成的静态数据
        const generatedPath = path.join(process.cwd(), 'generated', 'cloudflare.json');
        
        if (fs.existsSync(generatedPath)) {
          const data = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(data));
        } else {
          // 返回空数据
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            enabled: false,
            fetchedAt: null,
            domain: 'blog.pldduck.com',
            timeWindows: []
          }));
        }
      });
    }
  };
}
