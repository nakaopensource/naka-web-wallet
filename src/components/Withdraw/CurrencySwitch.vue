<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import CurrencyIcon from '@/components/Withdraw/CurrencyIcon.vue';

/*Props*/
const props = withDefaults(defineProps<{variant?: 'dark' | 'light'}>(), {
  variant: 'light'
});

/*Global state*/
const contractsStore = useContractsStore();
</script>

<template>
  <div
    v-if="contractsStore.showCurrencySwitch"
    class="currency__switch"
    :class="`currency__switch--${props.variant}`"
  >
    <button
      v-for="token in contractsStore.tokens"
      :key="token.value"
      type="button"
      class="currency__switch--item"
      :aria-label="`Select ${token.name}`"
      :class="{
        active:
          token.value.toLowerCase() ===
          contractsStore.currencyToken.toLowerCase()
      }"
      @click="contractsStore.currencyToken = token.value"
    >
      <CurrencyIcon :name="token.name" />
      <span>{{ token.name }}</span>
    </button>
  </div>
</template>
