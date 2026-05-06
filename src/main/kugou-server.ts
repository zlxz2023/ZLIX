import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';

interface ModuleDefinition {
  identifier: string;
  route: string;
  module: (params: any, useAxios: any) => Promise<any>;
}

interface ApiRequest {
  method: string;
  url: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
}

interface ApiResponse {
  status: number;
  body: any;
  cookie?: string[];
  headers?: Record<string, string>;
}

const isDev = !app.isPackaged;
let moduleMap: Map<string, ModuleDefinition> = new Map();
let serverReady = false;
let createRequestFn: ((config: any) => Promise<any>) | null = null;

const noCacheRoutes: string[] = [
  '/playlist/add',
  '/playlist/del',
  '/playlist/tracks/add',
  '/playlist/tracks/del',
  '/artist/follow',
  '/artist/unfollow',
  '/playhistory/upload',
  '/login/qr/key',
  '/login/qr/create',
  '/login/qr/check',
  '/login/cellphone',
  '/login/wx/create',
  '/login/wx/check',
  '/login/openplat',
  '/captcha/sent',
  '/register/dev',
  '/youth/day/vip',
  '/youth/day/vip/upgrade',
  '/youth/vip',
];

const invalidationMap: Record<string, string[]> = {
  '/playlist/add': ['/user/playlist'],
  '/playlist/del': ['/user/playlist'],
  '/playlist/tracks/add': ['/playlist/track/all', '/playlist/track/all/new'],
  '/playlist/tracks/del': ['/playlist/track/all', '/playlist/track/all/new'],
  '/artist/follow': ['/user/follow'],
  '/artist/unfollow': ['/user/follow'],
  '/playhistory/upload': ['/user/history'],
};

let guid = '';
let serverDev = '';
let mid = '';

class LRUCache {
  private cache: Map<string, { value: any; timestamp: number }>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): any | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const apiCache = new LRUCache(200, 30 * 60 * 1000);

const resolveServerPath = (): string => {
  if (isDev) {
    return path.join(process.cwd(), 'src/api-server/kugou');
  }
  return path.join(process.resourcesPath, 'api-server/kugou');
};

const loadModules = (serverPath: string): ModuleDefinition[] => {
  const modulesPath = path.join(serverPath, 'module');
  if (!fs.existsSync(modulesPath)) {
    console.warn('[KugouServer] Module path not found:', modulesPath);
    return [];
  }
  const files = fs.readdirSync(modulesPath);

  return files
    .reverse()
    .filter((fileName) => fileName.endsWith('.js') && !fileName.startsWith('_'))
    .map((fileName) => {
      const identifier = fileName.split('.').shift() || fileName;
      const route = '/' + fileName.replace(/\.js$/i, '').replace(/_/g, '/');
      const modulePath = path.resolve(modulesPath, fileName);
      const mod = require(modulePath);
      return { identifier, route, module: mod };
    });
};

export async function initKugouServer(): Promise<void> {
  if (serverReady) {
    console.log('[KugouServer] Already initialized, skipping...');
    return;
  }

  const serverPath = resolveServerPath();
  console.log('[KugouServer] Initializing from:', serverPath);
  console.log('[KugouServer] Exists:', fs.existsSync(serverPath));
  console.log('[KugouServer] Util path exists:', fs.existsSync(path.join(serverPath, 'util')));
  console.log('[KugouServer] Module path exists:', fs.existsSync(path.join(serverPath, 'module')));

  process.env.platform = 'lite';

  const envPath = path.join(serverPath, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const dotenv = require(path.join(serverPath, 'node_modules', 'dotenv'));
      dotenv.config({ path: envPath, quiet: true });
    } catch {
      // dotenv is optional
    }
  }

  const utilPath = path.join(serverPath, 'util');
  let cryptoMd5: (str: string) => string;
  let getGuid: () => string;
  let randomString: (len: number) => string;
  let calculateMid: (guid: string) => string;
  let createRequest: (config: any) => Promise<any>;
  let applyCliOverrides: (args: string[]) => void;

  try {
    const util = require(path.join(utilPath, 'index'));

    cryptoMd5 = util.cryptoMd5;
    getGuid = util.getGuid;
    randomString = util.randomString;
    calculateMid = util.calculateMid;
    createRequest = util.createRequest;

    const runtime = require(path.join(utilPath, 'runtime'));
    applyCliOverrides = runtime.applyCliOverrides;
  } catch (e) {
    console.error('[KugouServer] Failed to load utilities:', e);
    return;
  }

  applyCliOverrides(['--platform=lite']);

  guid = process.env.KUGOU_API_GUID || cryptoMd5(getGuid());
  serverDev = (process.env.KUGOU_API_DEV || randomString(10)).toUpperCase();
  mid = calculateMid(guid);

  createRequestFn = createRequest;

  const modules = loadModules(serverPath);
  moduleMap = new Map();
  for (const mod of modules) {
    moduleMap.set(mod.route, mod);
    console.log(`[KugouServer] Route registered: ${mod.route}`);
  }

  serverReady = true;
  console.log(`[KugouServer] Initialized, ${moduleMap.size} modules loaded`);
}

const matchModule = (url: string): ModuleDefinition | null => {
  const pathname = url.split('?')[0];
  if (moduleMap.has(pathname)) {
    return moduleMap.get(pathname)!;
  }
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (moduleMap.has(normalized)) {
    return moduleMap.get(normalized)!;
  }
  return null;
};

const parseAuthCookie = (authHeader?: string): Record<string, string> => {
  if (!authHeader) return {};
  const result: Record<string, string> = {};
  authHeader.split(';').forEach((pair) => {
    const eqIndex = pair.indexOf('=');
    if (eqIndex < 1) return;
    const key = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    if (key && value) result[key] = value;
  });
  return result;
};

const buildDefaultCookies = (): Record<string, string> => {
  return {
    KUGOU_API_PLATFORM: process.env.platform || 'lite',
    KUGOU_API_MID: mid,
    KUGOU_API_GUID: guid,
    KUGOU_API_DEV: serverDev,
    KUGOU_API_MAC: (process.env.KUGOU_API_MAC || '02:00:00:00:00:00').toUpperCase(),
  };
};

const buildCacheKey = (method: string, url: string, params?: Record<string, any>): string => {
  const sortedParams = Object.entries(params || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${method}:${url}${sortedParams ? '?' + sortedParams : ''}`;
};

const isNoCacheRoute = (url: string): boolean => {
  const pathname = url.split('?')[0];
  return noCacheRoutes.includes(pathname);
};

const invalidateRelatedCache = (url: string): void => {
  const pathname = url.split('?')[0];
  const relatedRoutes = invalidationMap[pathname];
  if (!relatedRoutes || relatedRoutes.length === 0) return;

  const keysToDelete = apiCache.keys().filter((key) => {
    return relatedRoutes.some((route) => key.includes(route));
  });

  for (const key of keysToDelete) {
    apiCache.delete(key);
  }
};

const handleApiRequest = async (request: ApiRequest): Promise<ApiResponse> => {
  if (!serverReady || !createRequestFn) {
    return { status: 503, body: { code: 503, msg: 'Service not ready' } };
  }

  const mod = matchModule(request.url);
  if (!mod) {
    return { status: 404, body: { code: 404, data: null, msg: 'Not Found' } };
  }

  const isGet = request.method === 'GET';
  const noCache = isNoCacheRoute(request.url);
  const cacheKey = isGet && !noCache ? buildCacheKey(request.method, request.url, request.params) : '';

  if (isGet && !noCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const defaultCookies = buildDefaultCookies();
  const authCookies = parseAuthCookie(
    request.headers?.['Authorization'] || request.headers?.['authorization'],
  );
  const mergedCookies = { ...defaultCookies, ...authCookies };

  const rawParams = request.params || {};
  const stringifiedParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    stringifiedParams[key] =
      value === null || value === undefined
        ? value
        : typeof value === 'object'
          ? value
          : String(value);
  }
  const { cookie: paramCookie, ...restParams } = stringifiedParams;

  const cookieFromParams =
    typeof paramCookie === 'string' ? parseAuthCookie(paramCookie) : paramCookie || {};
  const finalCookie = { ...mergedCookies, ...cookieFromParams };

  const query: any = {
    cookie: finalCookie,
    ...restParams,
  };

  if (request.data) {
    query.body = request.data;
  }

  try {
    const moduleResponse = await mod.module(query, (config: any) => {
      config.ip = '';
      return createRequestFn!(config);
    });

    const response: ApiResponse = {
      status: moduleResponse.status || 200,
      body: moduleResponse.body,
      cookie: moduleResponse.cookie,
      headers: moduleResponse.headers,
    };

    if (isGet && response.status < 400) {
      if (!noCache) {
        apiCache.set(cacheKey, response);
      } else {
        invalidateRelatedCache(request.url);
      }
    }

    return response;
  } catch (e: any) {
    const moduleResponse = e;

    if (!moduleResponse?.body) {
      return { status: 404, body: { code: 404, data: null, msg: 'Not Found' } };
    }

    return {
      status: moduleResponse.status || 502,
      body: moduleResponse.body,
      cookie: moduleResponse.cookie,
      headers: moduleResponse.headers,
    };
  }
};

export function registerKugouApiIpcHandler(): void {
  console.log('[KugouServer] Registering IPC handlers...');
  console.log('[KugouServer] serverReady:', serverReady);

  ipcMain.handle('api:request', async (_event, request: ApiRequest): Promise<ApiResponse> => {
    console.log('[KugouServer] Received api:request:', request.method, request.url);
    console.log('[KugouServer] serverReady:', serverReady, 'createRequestFn:', !!createRequestFn);
    return handleApiRequest(request);
  });

  ipcMain.handle('api:cache-clear', () => {
    const size = apiCache.size;
    apiCache.clear();
    console.log(`[KugouServer] Cache cleared: ${size} entries removed`);
    return { success: true };
  });
}

export function isKugouServerReady(): boolean {
  return serverReady;
}