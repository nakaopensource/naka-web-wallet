<script setup lang="ts">
import {formatWithAtLeastTwoDecimals} from '@/utils/helpers.ts';
import {useContractsStore} from '@/stores/contracts.ts';
import {computed} from 'vue';
import CurrencySwitch from '@/components/UI/CurrencySwitch.vue';

/*Global state*/
const contractsStore = useContractsStore();

/*Computed*/
/** Selected token's available balance; a dash when it couldn't be loaded */
const balanceText = computed(() =>
  contractsStore.selectedBalance === null
    ? '—'
    : formatWithAtLeastTwoDecimals(contractsStore.selectedBalance)
);
</script>

<template>
  <div class="connect__withdraw--card">
    <div class="card__surface">
      <img
        class="card__image"
        src="/img/cardbg.webp"
        alt="Naka card"
        width="592"
        height="358"
      />
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
      <!-- Only when there is something to switch between (always on Avalanche: USDT / XAUT0) -->
      <CurrencySwitch
        v-if="contractsStore.tokens.length > 1"
        class="card__switch"
        tone="dark"
        label="Balance currency"
        :options="contractsStore.tokens"
        v-model="contractsStore.currencyToken"
        collapsible
      />
      <div class="card__balance" aria-live="polite">
        <!-- A failed read takes the title's place, so the layout never shifts -->
        <div
          class="card__balance--title card__balance--error"
          v-if="
            contractsStore.selectedBalanceFailed &&
            !contractsStore.loading.vaultBalance
          "
        >
          Couldn't load balance.
          <button
            type="button"
            aria-label="Retry loading balance"
            @click="contractsStore.getVaultBalance()"
          >
            Retry
          </button>
        </div>
        <div class="card__balance--title" v-else>Available balance</div>
        <div
          class="card__balance--skeleton"
          v-if="contractsStore.loading.vaultBalance"
          aria-label="Loading balance"
        ></div>
        <Transition name="card-balance" mode="out-in" v-else>
          <div
            class="card__balance--value"
            :key="contractsStore.currencyToken"
          >
            <div
              class="value__number"
              :style="{'--chars': balanceText.length}"
            >
              {{ balanceText }}
            </div>
            <div class="value__currency" v-if="contractsStore.activeChain">
              {{ contractsStore.selectedCurrency }}
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
