/**
 * Device Fingerprinting Utility
 * Generates a unique identifier for the current device/browser
 */

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenResolution: string;
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory?: number;
  cookieEnabled: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  browserFingerprint: string;
}

/**
 * Generates a stable device fingerprint based on browser characteristics
 */
export const generateDeviceFingerprint = async (): Promise<string> => {
  const components: string[] = [];

  // Basic browser info
  components.push(navigator.userAgent || '');
  components.push(navigator.platform || '');
  components.push(navigator.language || '');
  
  // Screen characteristics
  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  components.push(`${screen.pixelDepth || ''}`);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  
  // Hardware info
  components.push(`${navigator.hardwareConcurrency || 0}`);
  components.push(`${(navigator as any).deviceMemory || 0}`);
  
  // Browser capabilities
  components.push(`${navigator.cookieEnabled}`);
  components.push(`${typeof(Storage) !== 'undefined'}`);
  components.push(`${typeof(sessionStorage) !== 'undefined'}`);
  components.push(`${typeof(indexedDB) !== 'undefined'}`);
  
  // WebGL fingerprint (if available)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (ctx && 'getParameter' in ctx) {
      const webglCtx = ctx as WebGLRenderingContext;
      const renderer = webglCtx.getParameter(webglCtx.RENDERER) || '';
      const vendor = webglCtx.getParameter(webglCtx.VENDOR) || '';
      components.push(`${vendor}-${renderer}`);
    }
  } catch (e) {
    // WebGL not available, skip
  }
  
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('TelAgri Fingerprint 🌾', 2, 2);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    // Canvas not available, skip
  }
  
  // Create fingerprint hash
  const fingerprint = await createHash(components.join('|'));
  
  return fingerprint;
};

/**
 * Gets comprehensive device information
 */
export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const fingerprint = await generateDeviceFingerprint();
  
  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory,
    cookieEnabled: navigator.cookieEnabled,
    localStorage: typeof(Storage) !== 'undefined',
    sessionStorage: typeof(sessionStorage) !== 'undefined',
    indexedDB: typeof(indexedDB) !== 'undefined',
    browserFingerprint: fingerprint
  };
};

/**
 * Simple hash function using Web Crypto API
 */
const createHash = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Check if device fingerprinting is supported
 */
export const isDeviceFingerprintingSupported = (): boolean => {
  return !!(
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof navigator !== 'undefined' &&
    typeof screen !== 'undefined'
  );
};

/**
 * Get a simplified device description for display
 */
export const getDeviceDescription = (): string => {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  
  // Detect browser
  if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) browser = 'Chrome';
  else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
  else if (ua.indexOf('Edg') > -1) browser = 'Edge';
  
  // Detect OS
  if (ua.indexOf('Windows') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'macOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('iOS') > -1) os = 'iOS';
  
  return `${browser} on ${os}`;
}; 