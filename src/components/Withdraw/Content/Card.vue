<script setup lang="ts">
import {formatWithAtLeastTwoDecimals} from '@/utils/helpers.ts';
import {useContractsStore} from '@/stores/contracts.ts';
import CurrencySwitch from '@/components/Withdraw/CurrencySwitch.vue';

/*Global state*/
const contractsStore = useContractsStore();
</script>

<template>
  <div class="connect__withdraw--card">
    <img
      class="card__image"
      src="/img/cardbg.webp"
      alt="Naka card"
      width="592"
      height="358"
    />
    <CurrencySwitch variant="dark" />
    <div class="card__logo">
      <svg
        width="42"
        height="42"
        viewBox="0 0 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18.0959 0.827637H0.344727V41.6552H9.22029V2.27361L23.4212 41.6552H41.1723V0.827637H32.2968V40.2092L18.0959 0.827637Z"
          fill="#F8F8F8"
        />
      </svg>
    </div>
    <div class="card__balance">
      <div class="card__balance--title">Available balance</div>
      <div class="card__balance--value">
        <div class="value__number">
          {{ formatWithAtLeastTwoDecimals(contractsStore.selectedBalance) }}
        </div>
        <div class="value__currency">{{ contractsStore.selectedCurrency }}</div>
      </div>
    </div>
  </div>
</template>
