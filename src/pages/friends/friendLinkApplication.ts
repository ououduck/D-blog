const FRIEND_LINK_FIELDS = ['name', 'description', 'avatar', 'url', 'friendPageUrl', 'contact'] as const;
type FriendLinkField = (typeof FRIEND_LINK_FIELDS)[number];

export interface FriendLinkApplicationValues extends Record<FriendLinkField, string> {
  reciprocalLinkConfirmed: boolean;
}

interface FriendLinkApplicationErrors {
  name?: string;
  description?: string;
  avatar?: string;
  url?: string;
  friendPageUrl?: string;
  contact?: string;
  filename?: string;
  reciprocalLinkConfirmed?: string;
}

interface FriendLinkApplicationResult {
  filename: string;
  issueUrl: string;
  values: FriendLinkApplicationValues;
}

const FRIEND_LINK_ISSUE_TITLE_PREFIX = '[Friend Link]';

const FILENAME_PATTERN = /^[A-Za-z0-9_-]+(?:\.json)?$/;

const trimValues = (values: FriendLinkApplicationValues): FriendLinkApplicationValues => ({
  name: values.name.trim(),
  description: values.description.trim(),
  avatar: values.avatar.trim(),
  url: values.url.trim(),
  friendPageUrl: values.friendPageUrl.trim(),
  contact: values.contact.trim(),
  reciprocalLinkConfirmed: values.reciprocalLinkConfirmed,
});

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeFriendLinkFilename = (filename: string) => {
  const trimmed = filename.trim();
  const stem = trimmed.toLowerCase().endsWith('.json') ? trimmed.slice(0, -5) : trimmed;
  return `${stem}.json`;
};

const validateFriendLinkFilename = (filename: string): string | null => {
  const trimmed = filename.trim();
  if (!trimmed) {
    return '请输入文件名。';
  }

  if (!FILENAME_PATTERN.test(trimmed)) {
    return '文件名只能包含英文字母、数字、短横线和下划线。';
  }

  return null;
};

export const validateFriendLinkApplication = (values: FriendLinkApplicationValues, filename: string): FriendLinkApplicationErrors => {
  const trimmed = trimValues(values);
  const errors: FriendLinkApplicationErrors = {};

  FRIEND_LINK_FIELDS.forEach((field) => {
    if (!trimmed[field]) {
      errors[field] = '此项不能为空。';
    }
  });

  (['avatar', 'url', 'friendPageUrl'] as const).forEach((field) => {
    if (trimmed[field] && !isHttpUrl(trimmed[field])) {
      errors[field] = '请输入有效的 HTTP(S) 地址。';
    }
  });

  const filenameError = validateFriendLinkFilename(filename);
  if (filenameError) {
    errors.filename = filenameError;
  }

  if (!trimmed.reciprocalLinkConfirmed) {
    errors.reciprocalLinkConfirmed = '请先添加本站友链并确认。';
  }

  return errors;
};

const buildFriendLinkIssueBody = (values: FriendLinkApplicationValues, filename: string) => {
  const trimmed = trimValues(values);
  return [
    '## Friend Link Application',
    '',
    `- Site Name: ${trimmed.name}`,
    `- Site URL: ${trimmed.url}`,
    `- Friend Page URL: ${trimmed.friendPageUrl}`,
    `- Avatar URL: ${trimmed.avatar}`,
    `- Short Description: ${trimmed.description}`,
    `- Your Name / Contact: ${trimmed.contact}`,
    `- Filename: ${normalizeFriendLinkFilename(filename)}`,
    `- Reciprocal Link Added: ${trimmed.reciprocalLinkConfirmed ? 'yes' : 'no'}`,
  ].join('\n');
};

const buildFriendLinkIssueUrl = (values: FriendLinkApplicationValues, filename: string, repoUrl: string) => {
  const trimmed = trimValues(values);
  const params = new URLSearchParams({
    title: `${FRIEND_LINK_ISSUE_TITLE_PREFIX} ${trimmed.name}`,
    body: buildFriendLinkIssueBody(trimmed, filename),
  });
  return `${repoUrl.replace(/\/$/, '')}/issues/new?${params.toString()}`;
};

export const createFriendLinkApplication = (values: FriendLinkApplicationValues, filename: string, repoUrl: string): FriendLinkApplicationResult => {
  const errors = validateFriendLinkApplication(values, filename);
  if (Object.keys(errors).length > 0) {
    throw new Error('友链申请信息校验失败。');
  }

  const trimmedValues = trimValues(values);
  return {
    filename: normalizeFriendLinkFilename(filename),
    issueUrl: buildFriendLinkIssueUrl(trimmedValues, filename, repoUrl),
    values: trimmedValues,
  };
};
