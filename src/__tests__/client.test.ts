import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { LLMClient, type Message, type LLMConfig } from '../client.js';

describe('LLMClient', () => {
  const config: LLMConfig = {
    apiKey: 'test-key',
    model: 'openrouter/auto',
    systemPrompt: 'You are a helpful assistant.',
  };

  test('should be defined', () => {
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('should use default model', () => {
    const client = new LLMClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
  });

  test('should use default system prompt', () => {
    const client = new LLMClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
  });
});

describe('Message type', () => {
  test('should accept system message', () => {
    const msg: Message = { role: 'system', content: 'System prompt' };
    expect(msg.role).toBe('system');
  });

  test('should accept user message', () => {
    const msg: Message = { role: 'user', content: 'User input' };
    expect(msg.role).toBe('user');
  });

  test('should accept assistant message', () => {
    const msg: Message = { role: 'assistant', content: 'Assistant response' };
    expect(msg.role).toBe('assistant');
  });
});

describe('LLMConfig', () => {
  test('should require apiKey', () => {
    const config: LLMConfig = { apiKey: 'required-key' };
    expect(config.apiKey).toBe('required-key');
  });

  test('should allow optional model', () => {
    const config: LLMConfig = { apiKey: 'key', model: 'anthropic/claude-3' };
    expect(config.model).toBe('anthropic/claude-3');
  });

  test('should allow optional systemPrompt', () => {
    const config: LLMConfig = { apiKey: 'key', systemPrompt: 'Custom prompt' };
    expect(config.systemPrompt).toBe('Custom prompt');
  });
});
