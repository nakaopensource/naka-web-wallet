<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import DefineAmount from '@/components/Withdraw/Form/DefineAmount.vue';
import Processing from '@/components/Withdraw/Form/Processing.vue';
import Unsuccessful from '@/components/Withdraw/Form/Unsuccessful.vue';

/*Global state*/
const contractsStore = useContractsStore();

/*Methods*/
const resetAmount = () => {
  contractsStore.updateFormField(null, 'connected', 'amount');
};

const cancelForm = () => {
  contractsStore.updateModal({withdrawConnected: false});
  contractsStore.updateError({connected: false});
  contractsStore.updateLoading({withdrawConnected: false});
  contractsStore.updateWallet('connected', {step: 1});
  contractsStore.updateFormField(null, 'connected', 'amount');
};

/** MAX fills the selected token's available balance */
const setMaxAmount = () => {
  if (contractsStore.selectedBalance === null) {
    return;
  }

  contractsStore.updateFormField(
    contractsStore.selectedBalance,
    'connected',
    'amount'
  );
};
</script>

<template>
  <form
    class="connected__form"
    @submit.prevent="contractsStore.submitConnectedForm"
  >
    <DefineAmount
      v-if="
        contractsStore.wallets.connected.step === 1 &&
        !contractsStore.error.connected
      "
      :resetAmount="resetAmount"
      :amountData="contractsStore.form.connected.amount"
      :setMax="setMaxAmount"
      :loading="contractsStore.loading.withdrawConnected"
    />
    <Processing
      :amountData="contractsStore.form.connected.amount"
      v-if="
        contractsStore.wallets.connected.step === 2 &&
        !contractsStore.error.connected
      "
    />
    <Unsuccessful
      v-if="contractsStore.error.connected"
      :cancelForm="cancelForm"
      :loading="contractsStore.loading.withdrawConnected"
    />
  </form>
</template>
