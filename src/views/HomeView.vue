<script setup lang="ts">
import Metamask from '@/components/Home/Metamask.vue';
import {useContractsStore} from '@/stores/contracts.ts';
import Withdraw from '@/components/Withdraw/Withdraw.vue';
import NoVault from '@/components/Home/NoVault.vue';

/*Global state*/
const contractsStore = useContractsStore();
</script>

<template>
  <!-- No vault for the connected wallet -->
  <NoVault
    v-if="contractsStore.vaultMissing && !contractsStore.loading.connect"
  />

  <!-- Initial box -->
  <Metamask
    v-else-if="!contractsStore.vaultContract || contractsStore.loading.connect"
  />

  <!-- Withdraw and transaction history -->
  <Withdraw v-else />
</template>
