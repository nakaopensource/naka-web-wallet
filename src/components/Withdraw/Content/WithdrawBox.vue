<script setup lang="ts">
import TokenIcon from '@/components/UI/TokenIcon.vue';
import {useContractsStore} from '@/stores/contracts.ts';

/*Props*/
const props = defineProps<{
  title: string;
  description: string;
  buttonText: string;
}>();

/*Global state*/
const contractsStore = useContractsStore();
</script>

<template>
  <div class="connect__withdraw--box">
    <div class="box__title">{{ props.title }}</div>
    <div class="box__text">
      {{ props.description }}
    </div>
    <div class="box__chain">
      <div class="box__chain--text">Supported:</div>
      <!-- Follows the currency picked on the card / in the withdraw form -->
      <div
        class="box__chain--network"
        v-if="contractsStore.activeChain && contractsStore.selectedCurrency"
      >
        <TokenIcon :name="contractsStore.selectedCurrency" />
        <span
          >{{ contractsStore.selectedCurrency }} on
          {{ contractsStore.activeChain.name }}</span
        >
      </div>
    </div>
    <div class="box__button">
      <button aria-label="Withdraw to connected wallet" type="button">
        <svg
          class="arrow"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g clip-path="url(#clip0_5950_10307)">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M11.1402 0.859835C11.2866 1.00628 11.2866 1.24372 11.1402 1.39017L1.39017 11.1402C1.24372 11.2866 1.00628 11.2866 0.859835 11.1402C0.713388 10.9937 0.713388 10.7563 0.859835 10.6098L10.6098 0.859835C10.7563 0.713388 10.9937 0.713388 11.1402 0.859835Z"
              fill="#F8F8F8"
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M5.25 1.125C5.25 0.917893 5.41789 0.75 5.625 0.75H10.875C11.0821 0.75 11.25 0.917893 11.25 1.125V6.375C11.25 6.58211 11.0821 6.75 10.875 6.75C10.6679 6.75 10.5 6.58211 10.5 6.375V1.5H5.625C5.41789 1.5 5.25 1.33211 5.25 1.125Z"
              fill="#F8F8F8"
            />
          </g>
          <defs>
            <clipPath id="clip0_5950_10307">
              <rect width="12" height="12" fill="white" />
            </clipPath>
          </defs>
        </svg>
        <span class="button__text">{{ props.buttonText }}</span>
      </button>
    </div>
  </div>
</template>
