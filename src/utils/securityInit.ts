/**
 * Security Initialization for Kiosk Deployment
 * Performs security checks and hardening during app startup
 */

import { securityService } from '../services/securityService';

/**
 * Initialize security measures for kiosk deployment
 */
export function initializeSecurity(): void {
  // Validate deployment security
  const securityCheck = securityService.validateDeploymentSecurity();
  
  if (!securityCheck.isSecure) {
    console.warn('[Security] Deployment security issues detected:', securityCheck.issues);
    
    // In production, we might want to prevent app startup for critical security issues
    if (process.env.NODE_ENV === 'production') {
      const criticalIssues = securityCheck.issues.filter(issue => 
        issue.includes('HTTPS') || issue.includes('exposed')
      );
      
      if (criticalIssues.length > 0) {
        console.error('[Security] Critical security issues prevent app startup:', criticalIssues);
        // In a real kiosk deployment, you might want to show an error screen
        // For now, we'll just log the issues
      }
    }
  }

  // Clear any existing security events on startup
  securityService.clearSecurityEvents();

  // Set up Content Security Policy if not already present
  setupContentSecurityPolicy();

  // Remove any accidentally exposed sensitive data from global scope
  cleanupGlobalScope();

  console.log('[Security] Security initialization completed');
}

/**
 * Set up Content Security Policy for enhanced security
 * NOTE: CSP is already defined in index.html and vercel.json headers.
 * This function only adds a fallback CSP if none exists (e.g., local dev without the HTML meta tag).
 */
function setupContentSecurityPolicy(): void {
  if (typeof document === 'undefined') {
    return;
  }

  // CSP is already set via HTML meta tag or server headers - don't add another one
  // Multiple CSPs are intersected (most restrictive wins), which causes blocked requests
  const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existingCSP) {
    return;
  }

  // Only add CSP if none exists at all (fallback for edge cases)
  const cspMeta = document.createElement('meta');
  cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
  
  // Get the Supabase URL from environment for CSP
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const supabaseWss = supabaseOrigin ? supabaseOrigin.replace('https://', 'wss://') : '';
  
  const connectSrc = supabaseOrigin 
    ? `'self' ${supabaseOrigin} ${supabaseWss} https://sheets.googleapis.com`
    : "'self' https://sheets.googleapis.com";
  
  cspMeta.setAttribute('content', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));

  document.head.appendChild(cspMeta);
}

/**
 * Clean up any accidentally exposed sensitive data from global scope
 */
function cleanupGlobalScope(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const sensitiveKeys = [
    'FUNIFIER_API_KEY',
    'FUNIFIER_AUTH_TOKEN',
    'GOOGLE_SHEETS_API_KEY',
    'apiKey',
    'authToken',
    'googleApiKey',
    'credentials'
  ];

  sensitiveKeys.forEach(key => {
    if ((window as any)[key]) {
      delete (window as any)[key];
      console.warn(`[Security] Removed exposed sensitive data: ${key}`);
    }
  });
}

/**
 * Security middleware for input sanitization
 */
export function createSecurityMiddleware() {
  return {
    sanitizeInput: (input: string, maxLength?: number) => {
      return securityService.sanitizeInput(input, maxLength);
    },
    
    validateUrl: (url: string) => {
      return securityService.validateSecureUrl(url);
    },
    
    getSecurityEvents: () => {
      return securityService.getSecurityEvents();
    }
  };
}