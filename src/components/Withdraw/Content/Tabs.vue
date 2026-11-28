<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import {shortenAddress} from '@/utils/helpers.ts';

/*Global state*/
const contractsStore = useContractsStore();

/*Methods*/
const setActiveVault = async (vaultId: number) => {
  await contractsStore.updateActiveVault(vaultId);
};
</script>

<template>
  <div class="withdraw__screen--tabs-wrap">
    <h2 class="tab__title">Available contracts</h2>
    <div class="withdraw__screen--tabs">
      <button
        class="tab"
        aria-label="Select contract"
        v-for="(vault, vaultId) in contractsStore.availableVaults"
        :class="{active: contractsStore.contractIndex === vaultId}"
        @click="setActiveVault(vaultId)"
      >
        {{ shortenAddress(vault) }}
      </button>
    </div>
  </div>
</template>
