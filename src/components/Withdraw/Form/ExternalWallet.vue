<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import DefineAmount from '@/components/Withdraw/Form/DefineAmount.vue';
import DefineAddress from '@/components/Withdraw/Form/DefineAddress.vue';
import Processing from '@/components/Withdraw/Form/Processing.vue';
import Unsuccessful from '@/components/Withdraw/Form/Unsuccessful.vue';
import {validateAddress} from '@/utils/helpers.ts';

/*Global state*/
const contractsStore = useContractsStore();

/*Methods*/
const resetAmount = () => {
  contractsStore.updateFormField(null, 'external', 'amount');
};

const resetAddress = () => {
  contractsStore.updateFormField('', 'external', 'address');
};

const onAddressChange = () => {
  contractsStore.updateError({externalAddress: false});

  /** Check that the wallet address is indeed the correct format */
  if (
    validateAddress(contractsStore.form.external.address.value) ||
    contractsStore.form.external.address.value.length < 2
  ) {
    return;
  }

  contractsStore.updateError({externalAddress: true});
};

const cancelForm = () => {
  contractsStore.updateModal({withdrawExternal: false});
  contractsStore.updateError({external: false});
  contractsStore.updateLoading({withdrawExternal: false});
  contractsStore.updateWallet('external', {step: 1});
  contractsStore.updateFormField(null, 'external', 'amount');
  contractsStore.updateFormField('', 'external', 'address');
};

/** MAX fills the selected token's available balance */
const setMaxAmount = () => {
  if (contractsStore.selectedBalance === null) {
    return;
  }

  contractsStore.updateFormField(
    contractsStore.selectedBalance,
    'external',
    'amount'
  );
};
</script>

<template>
  <form
    class="connected__form external__form"
    @submit.prevent="contractsStore.submitExternalForm"
  >
    <DefineAmount
      :amountData="contractsStore.form.external.amount"
      :resetAmount="resetAmount"
      :setMax="setMaxAmount"
      v-if="
        contractsStore.wallets.external.step === 1 &&
        !contractsStore.error.external
      "
    />
    <DefineAddress
      :form="contractsStore.form.external"
      :resetAddress="resetAddress"
      :onAddressChange="onAddressChange"
      :errorActive="contractsStore.error.externalAddress"
      :loading="contractsStore.loading.withdrawExternal"
      v-if="
        contractsStore.wallets.external.step === 2 &&
        !contractsStore.error.external
      "
    />
    <Processing
      :amountData="contractsStore.form.external.amount"
      v-if="
        contractsStore.wallets.external.step === 3 &&
        !contractsStore.error.external
      "
    />
    <Unsuccessful
      v-if="contractsStore.error.external"
      :cancelForm="cancelForm"
      :loading="contractsStore.loading.withdrawExternal"
    />
  </form>
</template>
