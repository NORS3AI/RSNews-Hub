import { describe, it, expect, afterEach, vi } from 'vitest';
import { captureError, setErrorForwarder, isErrorForwarderSet } from './logger';

afterEach(() => { setErrorForwarder(null); vi.restoreAllMocks(); });

describe('captureError', () => {
  it('always emits a structured error log line', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureError(new Error('boom'), { route: 'x' });
    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.level).toBe('error');
    expect(line.msg).toBe('boom');
    expect(line.route).toBe('x');
  });

  it('coerces non-Error throwables into an Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureError('just a string');
    expect(JSON.parse(spy.mock.calls[0][0] as string).msg).toBe('just a string');
  });

  it('forwards to a registered sink and passes context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn();
    expect(isErrorForwarderSet()).toBe(false);
    setErrorForwarder(sink);
    expect(isErrorForwarderSet()).toBe(true);
    const err = new Error('fwd');
    captureError(err, { a: 1 });
    expect(sink).toHaveBeenCalledWith(err, { a: 1 });
  });

  it('never throws even if the forwarder throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setErrorForwarder(() => { throw new Error('sink exploded'); });
    expect(() => captureError(new Error('x'))).not.toThrow();
  });
});
