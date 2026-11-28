import {beforeEach, describe, expect, it, vi} from 'vitest';
import {toast} from 'vue3-toastify';
import {
  bottomToast,
  copyToClipboard,
  formatNumberToUint256,
  formatUint256toNumber,
  formatWithAtLeastTwoDecimals,
  isMobileChrome,
  localizeDateTime,
  shortenAddress,
  validateAddress
} from '@/utils/helpers.ts';

vi.mock('vue3-toastify', () => {
  const toastFn = vi.fn() as unknown as typeof toast;
  return {toast: toastFn};
});

const setUserAgent = (ua: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true
  });
};

describe('formatUint256toNumber', () => {
  it('converts a whole-token amount with default 6 decimals', () => {
    expect(formatUint256toNumber(5_000_000n)).toBe(5);
  });

  it('converts a fractional amount', () => {
    expect(formatUint256toNumber(1_234_567n)).toBeCloseTo(1.234567, 6);
  });

  it('handles zero', () => {
    expect(formatUint256toNumber(0n)).toBe(0);
  });

  it('respects a custom decimals argument (18-decimal token)', () => {
    expect(formatUint256toNumber(1_500_000_000_000_000_000n, 18)).toBeCloseTo(
      1.5,
      10
    );
  });

  it('handles amounts below one base unit of display precision', () => {
    expect(formatUint256toNumber(1n)).toBeCloseTo(0.000001, 9);
  });

  it('returns the exact decimal value without float noise', () => {
    expect(formatUint256toNumber(12_894_056n)).toBe(12.894056);
  });
});

describe('formatNumberToUint256', () => {
  it('converts a whole number with default 6 decimals', () => {
    expect(formatNumberToUint256(5)).toBe(5_000_000n);
  });

  it('converts a fractional amount', () => {
    expect(formatNumberToUint256(1.234567)).toBe(1_234_567n);
  });

  it('rounds sub-precision values instead of truncating', () => {
    /** 0.1 + 0.2 = 0.30000000000000004 in floats — rounding must absorb it */
    expect(formatNumberToUint256(0.1 + 0.2)).toBe(300_000n);
  });

  it('respects a custom decimals argument', () => {
    expect(formatNumberToUint256(1.5, 18)).toBe(1_500_000_000_000_000_000n);
  });

  it('round-trips with formatUint256toNumber for typical amounts', () => {
    const amounts = [0.000001, 0.5, 1, 123.456789, 99999.99];
    for (const amount of amounts) {
      expect(formatUint256toNumber(formatNumberToUint256(amount))).toBeCloseTo(
        amount,
        6
      );
    }
  });
});

describe('validateAddress', () => {
  it('accepts a valid checksummed address', () => {
    expect(validateAddress('0x9ac93245367975b06013C1EE0204A5E42e91b57B')).toBe(
      true
    );
  });

  it('accepts a valid lowercase address', () => {
    expect(validateAddress('0xc2132d05d31c914a87c6611c10748aeb04b58e8f')).toBe(
      true
    );
  });

  it('rejects an empty string', () => {
    expect(validateAddress('')).toBe(false);
  });

  it('rejects a missing 0x prefix', () => {
    expect(validateAddress('9ac93245367975b06013C1EE0204A5E42e91b57B')).toBe(
      false
    );
  });

  it('rejects wrong length', () => {
    expect(validateAddress('0x9ac93245367975b06013C1EE0204A5E42e91b5')).toBe(
      false
    );
    expect(
      validateAddress('0x9ac93245367975b06013C1EE0204A5E42e91b57B00')
    ).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(validateAddress('0xZac93245367975b06013C1EE0204A5E42e91b57B')).toBe(
      false
    );
  });
});

describe('shortenAddress', () => {
  const address = '0x9ac93245367975b06013C1EE0204A5E42e91b57B';

  it('keeps the first six and last four characters by default', () => {
    expect(shortenAddress(address)).toBe('0x9ac9••••b57B');
  });

  it('respects custom lengths', () => {
    expect(shortenAddress(address, 4, 2)).toBe('0x9a••••7B');
  });

  it('returns short or empty values untouched', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234');
    expect(shortenAddress('')).toBe('');
  });
});

describe('formatWithAtLeastTwoDecimals', () => {
  it('pads an integer to two decimals', () => {
    expect(formatWithAtLeastTwoDecimals(5)).toBe('5.00');
  });

  it('pads a single decimal digit', () => {
    expect(formatWithAtLeastTwoDecimals(5.5)).toBe('5.50');
  });

  it('keeps up to six decimals', () => {
    expect(formatWithAtLeastTwoDecimals(5.55)).toBe('5.55');
    expect(formatWithAtLeastTwoDecimals(1.234567)).toBe('1.234567');
    expect(formatWithAtLeastTwoDecimals(0.0002)).toBe('0.0002');
  });

  it('rounds to six decimals and drops float noise', () => {
    expect(formatWithAtLeastTwoDecimals(12.894055999999999)).toBe('12.894056');
  });

  it('handles zero and null', () => {
    expect(formatWithAtLeastTwoDecimals(0)).toBe('0.00');
    expect(formatWithAtLeastTwoDecimals(null)).toBe('0.00');
  });
});

describe('localizeDateTime', () => {
  it('returns "/" for null input by default', () => {
    expect(localizeDateTime(null)).toBe('/');
  });

  it('returns "/" for undefined input by default', () => {
    expect(localizeDateTime()).toBe('/');
  });

  it('returns the custom empty output when provided', () => {
    expect(localizeDateTime(null, '—')).toBe('—');
  });

  it('formats a date with day, month, year and time', () => {
    const output = localizeDateTime(new Date('2026-07-17T14:30:45'));
    /** Locale spacing differs across ICU versions — assert on the digits */
    expect(output).toMatch(/17.*0?7.*2026/);
    expect(output).toMatch(/14[:.]30[:.]45/);
  });
});

describe('isMobileChrome', () => {
  it('detects Chrome on Android', () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
    );
    expect(isMobileChrome()).toBe(true);
  });

  it('detects Chrome on iOS (CriOS)', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1'
    );
    expect(isMobileChrome()).toBe(true);
  });

  it('returns false on desktop Chrome', () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    expect(isMobileChrome()).toBe(false);
  });

  it('returns false inside the MetaMask in-app browser', () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 MetaMask/7.24.0'
    );
    expect(isMobileChrome()).toBe(false);
  });

  it('returns false in mobile Edge', () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0 Edg/126.0.0.0'
    );
    expect(isMobileChrome()).toBe(false);
  });
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {writeText: vi.fn()},
      configurable: true
    });
  });

  it('writes the text to the clipboard and shows a toast', () => {
    copyToClipboard('0xabc');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xabc');
    expect(toast).toHaveBeenCalledWith(
      'Copied to clipboard',
      expect.objectContaining({autoClose: 1000})
    );
  });
});

describe('bottomToast', () => {
  it('passes the message, autoClose and class through to toast', () => {
    bottomToast('Done', 3000, 'toast__wide');
    expect(toast).toHaveBeenCalledWith(
      'Done',
      expect.objectContaining({
        autoClose: 3000,
        position: 'bottom-center',
        toastClassName: 'toast__wrap toast__wide'
      })
    );
  });

  it('omits the extra class cleanly when none is given', () => {
    bottomToast('Done', 1000);
    expect(toast).toHaveBeenCalledWith(
      'Done',
      expect.objectContaining({toastClassName: 'toast__wrap '})
    );
  });
});
