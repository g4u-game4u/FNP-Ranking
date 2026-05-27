import {
  sanitizeString,
  validatePlayerName,
  validateNumber,
  validateUrl,
  validateApiConfig,
} from '../validation';

describe('Validation Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe('Hello');
      expect(sanitizeString('<div>Test</div>')).toBe('Test');
      expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe('');
    });

    it('should decode HTML entities but remove dangerous tags', () => {
      expect(sanitizeString('&lt;script&gt;')).toBe(''); // Script tags are removed after decoding
      expect(sanitizeString('&amp;test&amp;')).toBe('&test&');
      expect(sanitizeString('&quot;hello&quot;')).toBe('"hello"');
      expect(sanitizeString('&lt;div&gt;content&lt;/div&gt;')).toBe('content'); // Safe tags are removed but content remains
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
      expect(sanitizeString(123 as any)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });
  });

  describe('validatePlayerName', () => {
    it('should sanitize and validate player names', () => {
      expect(validatePlayerName('John Doe')).toBe('John Doe');
      expect(validatePlayerName('<script>alert("xss")</script>John')).toBe('John');
      expect(validatePlayerName('')).toBe('Unknown Player');
      expect(validatePlayerName('   ')).toBe('Unknown Player');
    });

    it('should limit name length', () => {
      const longName = 'a'.repeat(150);
      const result = validatePlayerName(longName);
      expect(result.length).toBe(100);
    });
  });

  describe('validateNumber', () => {
    it('should validate and convert numbers', () => {
      expect(validateNumber(42)).toBe(42);
      expect(validateNumber('42')).toBe(42);
      expect(validateNumber('42.5')).toBe(42.5);
      expect(validateNumber('invalid')).toBe(0);
      expect(validateNumber(null)).toBe(0);
      expect(validateNumber(undefined)).toBe(0);
    });

    it('should ensure non-negative numbers', () => {
      expect(validateNumber(-5)).toBe(0);
      expect(validateNumber('-10')).toBe(0);
    });
  });

  describe('validateUrl', () => {
    it('should validate HTTP and HTTPS URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://example.com')).toBe(true);
      expect(validateUrl('https://api.example.com/v3')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('ftp://example.com')).toBe(false);
      expect(validateUrl('javascript:alert(1)')).toBe(false);
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('validateApiConfig', () => {
    const validConfig = {
      serverUrl: 'https://api.example.com',
      apiKey: 'test-key',
      authToken: 'Basic test-token',
    };

    it('should validate correct API config', () => {
      expect(validateApiConfig(validConfig)).toBe(true);
    });

    it('should reject invalid server URL', () => {
      expect(validateApiConfig({
        ...validConfig,
        serverUrl: 'invalid-url',
      })).toBe(false);
    });

    it('should reject missing API key', () => {
      expect(validateApiConfig({
        ...validConfig,
        apiKey: '',
      })).toBe(false);
    });

    it('should reject missing auth token', () => {
      expect(validateApiConfig({
        ...validConfig,
        authToken: '',
      })).toBe(false);
    });

    it('should reject null or undefined config', () => {
      expect(validateApiConfig(null)).toBe(false);
      expect(validateApiConfig(undefined)).toBe(false);
    });
  });
});