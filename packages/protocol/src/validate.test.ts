import { describe, it, expect } from 'vitest';
import { validateMessage } from './validate.js';

describe('validateMessage', () => {
  it('accepts a valid hello', () => {
    const r = validateMessage({ type: 'hello', protocolVersion: 1, config: {} });
    expect(r.ok).toBe(true);
  });

  it('rejects hello with wrong protocolVersion', () => {
    const r = validateMessage({ type: 'hello', protocolVersion: 2, config: {} });
    expect(r.ok).toBe(false);
  });

  it('accepts a sendMessage with only channel', () => {
    expect(validateMessage({ type: 'sendMessage', channel: 'orders' }).ok).toBe(true);
  });

  it('accepts a sendMessage with all optional fields', () => {
    expect(
      validateMessage({
        type: 'sendMessage',
        channel: 'orders',
        from: 'A',
        to: 'B',
        label: 'order#42',
        color: '#88ff88',
      }).ok,
    ).toBe(true);
  });

  it('rejects sendMessage with bad color', () => {
    expect(
      validateMessage({ type: 'sendMessage', channel: 'orders', color: 'green' }).ok,
    ).toBe(false);
  });

  it('rejects sendMessage with empty channel', () => {
    expect(validateMessage({ type: 'sendMessage', channel: '' }).ok).toBe(false);
  });

  it('accepts a messageSent', () => {
    expect(
      validateMessage({
        type: 'messageSent',
        id: 'm_1',
        channel: 'orders',
        from: 'A',
        to: 'B',
        color: '#abcdef',
        spawnedAt: 123,
      }).ok,
    ).toBe(true);
  });

  it('rejects messageSent missing required fields', () => {
    expect(
      validateMessage({ type: 'messageSent', id: 'm_1', channel: 'orders' }).ok,
    ).toBe(false);
  });

  it('rejects updateChannel with empty patch', () => {
    expect(
      validateMessage({ type: 'updateChannel', channel: 'orders', patch: {} }).ok,
    ).toBe(false);
  });

  it('accepts an error message with valid code', () => {
    expect(
      validateMessage({
        type: 'error',
        code: 'unknown_channel',
        message: 'oops',
      }).ok,
    ).toBe(true);
  });

  it('rejects error with unknown code', () => {
    expect(
      validateMessage({ type: 'error', code: 'made_up', message: 'oops' }).ok,
    ).toBe(false);
  });

  it('rejects unknown message type', () => {
    expect(validateMessage({ type: 'banana' }).ok).toBe(false);
  });
});
