<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import {shortenAddress} from '@/utils/helpers.ts';

/*Global state*/
const contractsStore = useContractsStore();

/*Methods*/
const setActiveVault = async (vaultId: number) => {
  /** Shown even with a single vault: clicking the active one shouldn't reload it */
  if (vaultId === contractsStore.contractIndex) {
    return;
  }

  await contractsStore.updateActiveVault(vaultId);
};
</script>

<template>
  <div class="withdraw__screen--tabs-wrap">
    <h2 class="tab__title">Available contracts</h2>
    <div
      class="withdraw__screen--tabs"
      role="radiogroup"
      aria-label="Available contracts"
    >
      <button
        type="button"
        role="radio"
        class="tab"
        v-for="(vault, vaultId) in contractsStore.availableVaults"
        :key="vault"
        :class="{active: contractsStore.contractIndex === vaultId}"
        :aria-checked="contractsStore.contractIndex === vaultId"
        :aria-label="`Contract ${vaultId + 1}: ${vault}`"
        :title="vault"
        @click="setActiveVault(vaultId)"
      >
        <span class="tab__label">Contract {{ vaultId + 1 }}</span>
        <span class="tab__address">{{ shortenAddress(vault) }}</span>
      </button>
    </div>
  </div>
</template>
