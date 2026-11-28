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

export const formatUint256toNumber = (value: bigint, decimals = 6) => {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = (value % divisor).toString().padStart(decimals, '0');

  /** Parse from a decimal string so there is no float noise (12.894055999999999) */
  return Number(`${integerPart}.${fractionalPart}`);
};

export const formatNumberToUint256 = (value: number, decimals = 6) => {
  return BigInt(Math.round(value * 10 ** decimals));
};

export const formatWithAtLeastTwoDecimals = (
  value: number | null,
  maxDecimals = 6
) => {
  if (value === null || !Number.isFinite(value)) {
    return '0.00';
  }

  /** Round to the max decimals, then trim trailing zeros but keep at least two decimals */
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

/**
 * Shortens a wallet or contract address, e.g. 0x1234...abcd
 * */
export const shortenAddress = (address: string, start = 6, end = 4) => {
  if (!address || address.length <= start + end) {
    return address || '';
  }

  return `${address.substring(0, start)}••••${address.slice(-end)}`;
};
