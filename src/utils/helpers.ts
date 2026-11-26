import {toast} from 'vue3-toastify';

export const bottomToast = (
  message: string,
  autoClose: number,
  className?: string
) => {
  toast(message, {
    autoClose: autoClose,
    type: 'info',
    theme: 'dark',
    position: 'bottom-center',
    transition: 'bounce',
    hideProgressBar: true,
    toastClassName: `toast__wrap ${className || ''}`,
    bodyClassName: 'toast__body'
  });
};

/** Short form of an address used across the app: 0x5B92••••7da7 */
export const shortenAddress = (address: string) =>
  address ? `${address.substring(0, 6)}••••${address.slice(-4)}` : '';

/**
 * With the power of Clipboard API the method copies the text of the sibling Element.
 * */
export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  bottomToast('Copied to clipboard', 1000);
};

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function isMobileChrome() {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isChrome =
    (/Chrome/i.test(ua) || /CriOS/i.test(ua)) &&
    !/Edg/i.test(ua) &&
    !/OPR/i.test(ua) &&
    !/Brave/i.test(ua);
  const isMetaMask = ua.includes('MetaMask');

  return isMobile && isChrome && !isMetaMask;
}

export const localizeDateTime = (date?: Date | null, emptyOutput?: string) => {
  if (!date) {
    return emptyOutput || '/';
  }

  return new Date(date).toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const openNewTab = (url: string) => {
  window.open(url, '_blank');
};

/**
 * uint256 token amount to a number. Built as a decimal string and parsed once:
 * adding the fractional part as a float (12 + 0.894056) yields noise like 12.894055999999999.
 */
export const formatUint256toNumber = (value: bigint, decimals = 6) => {
  const divisor = 10n ** BigInt(decimals);
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const integerPart = absolute / divisor;
  const fractionalPart = (absolute % divisor)
    .toString()
    .padStart(decimals, '0');

  return Number(`${sign}${integerPart}.${fractionalPart}`);
};

export const formatNumberToUint256 = (value: number, decimals = 6) => {
  return BigInt(Math.round(value * 10 ** decimals));
};

/**
 * Display a token amount with at least 2 and at most `maxDecimals` decimals
 * (6 = the tokens' precision). The cap also drops any floating-point noise.
 */
export const formatWithAtLeastTwoDecimals = (value: number, maxDecimals = 6) => {
  const [integer, decimals = ''] = value.toFixed(maxDecimals).split('.');

  return `${integer}.${decimals.replace(/0+$/, '').padEnd(2, '0')}`;
};

export const validateAddress = (address: string) => {
  if (!address) {
    return false;
  }

  const addressRegEx = /^0x[a-fA-F0-9]{40}$/;
  return addressRegEx.test(address);
};
