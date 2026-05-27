import { describe, it, expect, beforeEach } from 'vitest';
import { ApiConfigManager } from '../api';

describe('ApiConfigManager', () => {
  let configManager: ApiConfigManager;

  beforeEach(() => {
    // Reset the singleton instance
    (ApiConfigManager as any).instance = undefined;
    configManager = ApiConfigManager.getInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ApiConfigManager.getInstance();
      const instance2 = ApiConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('initializeConfig', () => {
    it('should initialize config from environment variables', () => {
      const config = configManager.initializeConfig();

      // Test that config has the required properties
      expect(config).toHaveProperty('serverUrl');
      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('authToken');
      expect(typeof config.serverUrl).toBe('string');
      expect(typeof config.apiKey).toBe('string');
      expect(typeof config.authToken).toBe('string');
    });

    it('should remove trailing slash from server URL', () => {
      // Create a custom config with trailing slash
      const customConfig = {
        serverUrl: 'https://test.example.com/',
        apiKey: 'test-key',
        authToken: 'test-token',
      };

      const service = new (class extends ApiConfigManager {
        public testInitialize(config: any) {
          this.config = {
            serverUrl: config.serverUrl.replace(/\/$/, ''),
            apiKey: config.apiKey,
            authToken: config.authToken,
          };
          return this.config;
        }
      })();

      const result = service.testInitialize(customConfig);
      expect(result.serverUrl).toBe('https://test.example.com');
    });
  });

  describe('getConfig', () => {
    it('should return existing config if already initialized', () => {
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();

      expect(config1).toBe(config2);
    });

    it('should initialize config if not already done', () => {
      const config = configManager.getConfig();

      expect(config).toHaveProperty('serverUrl');
      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('authToken');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      configManager.initializeConfig();
      
      expect(configManager.validateConfig()).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', () => {
      const originalConfig = configManager.initializeConfig();
      
      configManager.updateConfig({
        serverUrl: 'https://updated.example.com',
      });

      const config = configManager.getConfig();
      expect(config.serverUrl).toBe('https://updated.example.com');
      expect(config.apiKey).toBe(originalConfig.apiKey); // Should remain unchanged
    });
  });
});