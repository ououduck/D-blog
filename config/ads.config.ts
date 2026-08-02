/**
 * 广告数据配置
 * 存储赞助页展示的广告信息
 */

/**
 * 广告项接口
 */
export interface AdItem {
  /** 唯一标识符 */
  id: string;
  /** 广告名称/标题 */
  title: string;
  /** 广告图片路径（相对于 public 目录） */
  image: string;
  /** 广告跳转链接 */
  link: string;
  /** 图片 alt 文本 */
  alt: string;
}

/**
 * 广告配置数组
 */
export const adsConfig: AdItem[] = [
  {
    id: 'tencent-cloud',
    title: '腾讯云广告',
    image: '/ads-img/tencent-cloud.png',
    link: 'https://curl.qcloud.com/fBu6YgLR',
    alt: '腾讯云广告'
  }
];
