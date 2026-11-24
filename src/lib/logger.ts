export type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'secret',
  'authsecret',
  'opssecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'cookie',
  'authorization',
  'exactaddress',
  'exact_address',
  'checkininstructions',
  'checkininstructionsen',
  'checkininstructionsvi',
  'checkin_instructions_en',
  'checkin_instructions_vi',
  'hostcontactphone',
  'host_contact_phone',
]);

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase();
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase()) || SENSITIVE_KEYS.has(normalizeKey(k))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitiveData(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export interface LogRecord {
  ts: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
}

export function formatLogRecord(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): LogRecord {
  return {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data ? { data: redactSensitiveData(data) as Record<string, unknown> } : {}),
  };
}

export function logEvent(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): LogRecord {
  const record = formatLogRecord(level, event, data);
  const line = JSON.stringify(record);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
  return record;
}
