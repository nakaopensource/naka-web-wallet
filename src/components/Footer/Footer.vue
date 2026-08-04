<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import {ref, watch} from 'vue';
import Modal from '@/components/UI/Modal.vue';

/*Global state*/
const contractsStore = useContractsStore();

/*Local state*/
const rpcName = ref('');
const rpcUrl = ref('');

/*Methods*/
const closeModal = () => {
  contractsStore.updateModal({rpc: false});
  rpcName.value = '';
  rpcUrl.value = '';
};

const addRpc = () => {
  contractsStore.addRpc({name: rpcName.value, url: rpcUrl.value});
  closeModal();
};

/*Watchers*/
watch(
  () => contractsStore.rpc,
  () => {
    if (contractsStore.loading.history) {
      return;
    }

    contractsStore.resetWithdrawalsList();
    contractsStore.getWithdrawalHistory();
  }
);
</script>

<template>
  <!-- Add rpc modal -->
  <Modal
    :closeModal="closeModal"
    :active="contractsStore.modal.rpc"
    class="modal__withdraw--connected modal__rpc--wrap"
    wrapClass="modal__withdraw--wrap"
    backdropClass="modal__withdraw--backdrop"
  >
    <h3 class="modal__rpc--title">Add rpc</h3>
    <form class="modal__rpc--form" @submit.prevent="addRpc">
      <div class="modal__rpc--input-wrap">
        <div class="modal__rpc--input">
          <input
            type="text"
            required
            v-model="rpcName"
            placeholder="RPC name"
          />
        </div>
        <div class="modal__rpc--input">
          <input type="text" required v-model="rpcUrl" placeholder="RPC url" />
        </div>
      </div>
      <div class="connected__form--submit modal__rpc--buttons">
        <button
          class="submit__button button__add"
          type="submit"
          :class="{active: rpcName && rpcUrl}"
        >
          Confirm
        </button>
      </div>
    </form>
  </Modal>

  <!-- Footer -->
  <footer
    v-if="
      contractsStore.vaultContract &&
      !contractsStore.loading.connect &&
      contractsStore.activeChain
    "
  >
    <div class="naka__rpc withdraw__screen--history">
      <label class="rpc__label" for="rpc">RPC</label>
      <select
        v-model="contractsStore.rpc"
        name="rpc"
        id="rpc"
        class="history__selector--select"
        :disabled="contractsStore.loading.history"
      >
        <option v-for="rpc in contractsStore.activeChain.rpcs" :value="rpc">
          {{ rpc.name }}
        </option>
      </select>
      <button
        type="button"
        class="history__selector--select rpc__add"
        @click="contractsStore.updateModal({rpc: true})"
      >
        +
      </button>
    </div>
  </footer>
</template>
