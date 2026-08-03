export const FRIEND_LINK_FIELDS = ['name', 'description', 'avatar', 'url'] as const;
export type FriendLinkField = (typeof FRIEND_LINK_FIELDS)[number];

export type FriendLinkApplicationValues = Record<FriendLinkField, string>;

export interface FriendLinkApplicationErrors {
  name?: string;
  description?: string;
  avatar?: string;
  url?: string;
  filename?: string;
}

export interface FriendLinkApplicationResult {
  filename: string;
  json: string;
  values: FriendLinkApplicationValues;
}

export const FRIEND_LINK_EMAIL = 'i@pldduck.com';
export const FRIEND_LINK_EMAIL_SUBJECT = 'D-blog友链申请';

const FILENAME_PATTERN = /^[A-Za-z0-9_-]+(?:\.json)?$/;

const trimValues = (values: FriendLinkApplicationValues): FriendLinkApplicationValues => ({
  name: values.name.trim(),
  description: values.description.trim(),
  avatar: values.avatar.trim(),
  url: values.url.trim()
});

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const normalizeFriendLinkFilename = (filename: string) => {
  const trimmed = filename.trim();
  const stem = trimmed.toLowerCase().endsWith('.json') ? trimmed.slice(0, -5) : trimmed;
  return `${stem}.json`;
};

export const validateFriendLinkFilename = (filename: string): string | null => {
  const trimmed = filename.trim();
  if (!trimmed) {
    return '请输入文件名。';
  }

  if (!FILENAME_PATTERN.test(trimmed) || trimmed.toLowerCase() === '.json') {
    return '文件名只能包含英文字母、数字、短横线和下划线。';
  }

  return null;
};

export const buildFriendLinkJson = (values: FriendLinkApplicationValues) => {
  const trimmed = trimValues(values);
  return JSON.stringify(
    FRIEND_LINK_FIELDS.reduce<Record<FriendLinkField, string>>((result, field) => {
      result[field] = trimmed[field];
      return result;
    }, {} as Record<FriendLinkField, string>),
    null,
    2
  );
};

export const validateFriendLinkApplication = (
  values: FriendLinkApplicationValues,
  filename: string
): FriendLinkApplicationErrors => {
  const trimmed = trimValues(values);
  const errors: FriendLinkApplicationErrors = {};

  FRIEND_LINK_FIELDS.forEach((field) => {
    if (!trimmed[field]) {
      errors[field] = '此项不能为空。';
    }
  });

  if (trimmed.avatar && !isHttpUrl(trimmed.avatar)) {
    errors.avatar = '请输入有效的 HTTP(S) 地址。';
  }

  if (trimmed.url && !isHttpUrl(trimmed.url)) {
    errors.url = '请输入有效的 HTTP(S) 地址。';
  }

  const filenameError = validateFriendLinkFilename(filename);
  if (filenameError) {
    errors.filename = filenameError;
  }

  return errors;
};

export const createFriendLinkApplication = (
  values: FriendLinkApplicationValues,
  filename: string
): FriendLinkApplicationResult => {
  const errors = validateFriendLinkApplication(values, filename);
  if (Object.keys(errors).length > 0) {
    throw new Error('友链申请信息校验失败。');
  }

  const trimmedValues = trimValues(values);
  return {
    filename: normalizeFriendLinkFilename(filename),
    json: buildFriendLinkJson(trimmedValues),
    values: trimmedValues
  };
};

export const createFriendLinkMailto = (
  json: string,
  email = FRIEND_LINK_EMAIL,
  subject = FRIEND_LINK_EMAIL_SUBJECT
) => (
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(json)}`
);

export const downloadTextFile = (content: string, filename: string, mimeType = 'application/json') => {
  if (
    typeof document === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
    || typeof URL.revokeObjectURL !== 'function'
  ) {
    return false;
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return true;
};

export const copyText = async (value: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持复制。');
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (!document.execCommand('copy')) {
      throw new Error('复制操作未被浏览器允许。');
    }
  } finally {
    textArea.remove();
  }
};
