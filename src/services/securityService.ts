/**
 * Security Service for Kiosk Deployment
 * Centralizes security enhancements and hardening measures
 */

import { sanitizeString, validateUrl } from '../utils/validation';

/**
 * Security configuration for kiosk deployment
 */
export interface SecurityConfig {
  enforceHttps: boolean;
  sanitizeAllInputs: boolean;
  logSecurityEvents: boolean;
  maxInputLength: number;
}

/**
 * Security event types for monitoring
 */
export type SecurityEventType = 
  | 'xss_attempt'
  | 'invalid_url'
  | 'non_https_request'
  | 'malicious_input'
  | 'config_tampering';

/**
 * Security event for logging and monitoring
 */
export interface SecurityEvent {
  type: SecurityEventType;
  message: string;
  timestamp: number;
  details?: any;
}

/**
 * Security Service for enhanced kiosk deployment protection
 */
export class SecurityService {
  private static instance: SecurityService;
  private config: SecurityConfig;
  private securityEvents: SecurityEvent[] = [];

  private constructor() {
    this.config = {
      enforceHttps: true,
      sanitizeAllInputs: true,
      logSecurityEvents: true,
      maxInputLength: 1000,
    };
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Sanitize user input with enhanced security
   */
  public sanitizeInput(input: string, maxLength?: number): string {
    if (!this.config.sanitizeAllInputs) {
      return input;
    }

    const limit = maxLength || this.config.maxInputLength;
    let sanitized = input;

    // Truncate if too long
    if (sanitized.length > limit) {
      sanitized = sanitized.substring(0, limit);
      this.logSecurityEvent('malicious_input', 'Input truncated due to excessive length');
    }

    // Check for potential XSS attempts before sanitization
    if (this.detectXSSAttempt(sanitized)) {
      this.logSecurityEvent('xss_attempt', 'Potential XSS attempt detected and sanitized');
    }

    return sanitizeString(sanitized);
  }

  /**
   * Validate and enforce HTTPS URLs
   */
  public validateSecureUrl(url: string): boolean {
    if (!validateUrl(url)) {
      this.logSecurityEvent('invalid_url', `Invalid URL format: ${url}`);
      return false;
    }

    if (this.config.enforceHttps && !url.startsWith('https://')) {
      this.logSecurityEvent('non_https_request', `Non-HTTPS URL rejected: ${url}`);
      return false;
    }

    return true;
  }

  /**
   * Detect potential XSS attempts
   */
  private detectXSSAttempt(input: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /eval\(/i,
      /alert\(/i,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Log security events for monitoring
   */
  private logSecurityEvent(type: SecurityEventType, message: string, details?: any): void {
    if (!this.config.logSecurityEvents) {
      return;
    }

    const event: SecurityEvent = {
      type,
      message,
      timestamp: Date.now(),
      details,
    };

    this.securityEvents.push(event);

    // Keep only last 100 events to prevent memory issues
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    // Log to console in development, but not in production to avoid information disclosure
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Security] ${type}: ${message}`, details);
    }
  }

  /**
   * Get security events (for monitoring/debugging)
   */
  public getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents];
  }

  /**
   * Clear security events
   */
  public clearSecurityEvents(): void {
    this.securityEvents = [];
  }

  /**
   * Update security configuration
   */
  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logSecurityEvent('config_tampering', 'Security configuration updated');
  }

  /**
   * Get current security configuration (without sensitive details)
   */
  public getConfig(): Omit<SecurityConfig, 'logSecurityEvents'> {
    return {
      enforceHttps: this.config.enforceHttps,
      sanitizeAllInputs: this.config.sanitizeAllInputs,
      maxInputLength: this.config.maxInputLength,
    };
  }

  /**
   * Validate environment for secure deployment
   */
  public validateDeploymentSecurity(): {
    isSecure: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if running over HTTPS in production
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      issues.push('Application not served over HTTPS in production');
    }

    // Check for exposed sensitive data in global scope
    if (typeof window !== 'undefined') {
      const sensitiveKeys = ['apiKey', 'authToken'];
      sensitiveKeys.forEach(key => {
        if ((window as any)[key]) {
          issues.push(`Sensitive data exposed in global scope: ${key}`);
        }
      });
    }

    // Check Content Security Policy
    if (typeof document !== 'undefined') {
      const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      if (metaTags.length === 0) {
        issues.push('No Content Security Policy detected');
      }
    }

    return {
      isSecure: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const securityService = SecurityService.getInstance();