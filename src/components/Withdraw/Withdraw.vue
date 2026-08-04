<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import Modal from '@/components/UI/Modal.vue';
import ConnectedWallet from '@/components/Withdraw/Form/ConnectedWallet.vue';
import ExternalWallet from '@/components/Withdraw/Form/ExternalWallet.vue';
import WithdrawBox from '@/components/Withdraw/Content/WithdrawBox.vue';
import Card from '@/components/Withdraw/Content/Card.vue';
import {bottomToast, formatWithAtLeastTwoDecimals} from '@/utils/helpers.ts';
import HistoryList from '@/components/Withdraw/List/HistoryList.vue';
import Tabs from '@/components/Withdraw/Content/Tabs.vue';

/*Global state*/
const contractsStore = useContractsStore();

const closeConnectedModal = () => {
  contractsStore.updateModal({withdrawConnected: false});
  contractsStore.resetConnectedForm();
};

const closeExternalModal = () => {
  contractsStore.updateModal({withdrawExternal: false});
  contractsStore.resetExternalForm();
};

const openConnectedModal = () => {
  /** Stop propagation if the withdrawal has already been requested and hasn't been resolved yet */
  if (contractsStore.activeRequest) {
    bottomToast(
      'You can not create multiple withdrawal requests. Confirm or cancel the existing withdrawal to create a new one.',
      5000,
      'toast__wide toast__withdrawal'
    );
    return;
  }

  contractsStore.updateModal({withdrawConnected: true});
};

const openExternalModal = () => {
  /** Stop propagation if the withdrawal has already been requested and hasn't been resolved yet */
  if (contractsStore.activeRequest) {
    bottomToast(
      'You can not create multiple withdrawal requests. Confirm or cancel the existing withdrawal to create a new one.',
      5000,
      'toast__wide toast__withdrawal'
    );
    return;
  }

  contractsStore.updateModal({withdrawExternal: true});
};

const closeCancelWithdrawModal = () => {
  contractsStore.updateModal({cancelWithdraw: false});
  contractsStore.updateLoading({cancelWithdraw: false});
};

const closeCompleteWithdrawModal = () => {
  contractsStore.updateModal({completeWithdraw: false});
  contractsStore.updateLoading({completeWithdraw: false});
};

const closeOvertimeModal = () => {
  contractsStore.updateModal({overtime: false});
  contractsStore.updateLoading({completeWithdraw: false});
  contractsStore.updateLoading({cancelWithdraw: false});
};
</script>

<template>
  <!-- Connected wallet modal -->
  <Modal
    class="modal__withdraw--connected"
    wrapClass="modal__withdraw--wrap"
    backdropClass="modal__withdraw--backdrop"
    :closeModal="closeConnectedModal"
    :active="contractsStore.modal.withdrawConnected"
  >
    <ConnectedWallet />
  </Modal>

  <!-- External wallet modal -->
  <Modal
    class="modal__withdraw--connected modal__withdraw--external"
    wrapClass="modal__withdraw--wrap"
    backdropClass="modal__withdraw--backdrop"
    :closeModal="closeExternalModal"
    :active="contractsStore.modal.withdrawExternal"
  >
    <ExternalWallet />
  </Modal>

  <!-- Complete withdraw modal -->
  <Modal
    :closeModal="closeCompleteWithdrawModal"
    wrapClass="modal__withdraw--wrap-complete"
    class="modal__withdrawal--complete"
    :active="contractsStore.modal.completeWithdraw"
  >
    <div class="modal__title">Complete Withdrawal</div>
    <div class="complete__description">
      Please note that a small gas fee is required to complete your withdrawal.
      This fee ensures the secure and timely processing of your transaction. You
      can complete the withdrawal process after confirming the payment of the
      gas fee. Thank you for your understanding.
    </div>
    <div class="complete__button">
      <button
        type="button"
        aria-label="Complete withdrawal"
        @click="contractsStore.completeWithdraw"
      >
        Complete withdrawal
        <span class="loader" v-if="contractsStore.loading.withdraw">
          <span></span><span></span>
        </span>
      </button>
    </div>
  </Modal>

  <!-- Cancel withdraw modal -->
  <Modal
    :closeModal="closeCancelWithdrawModal"
    wrapClass="modal__withdraw--wrap-complete"
    class="modal__withdrawal--complete modal__withdrawal--cancel"
    :active="contractsStore.modal.cancelWithdraw"
  >
    <div class="modal__title">Cancel Withdrawal Request</div>
    <div class="complete__description">
      Please note that a small gas fee is required to complete your
      cancellation. This fee ensures the secure and timely processing of your
      transaction. You can cancel the withdrawal after confirming the payment of
      the gas fee. Thank you for your understanding.
    </div>
    <div class="cancel__button">
      <button
        type="button"
        aria-label="Cancel withdrawal request"
        @click="contractsStore.cancelWithdrawRequest"
      >
        Cancel withdrawal request
        <span class="loader" v-if="contractsStore.loading.cancelWithdraw">
          <span></span><span></span>
        </span>
      </button>
    </div>
  </Modal>

  <!-- Overtime withdraw modal -->
  <Modal
    :closeModal="closeOvertimeModal"
    wrapClass="modal__withdraw--wrap-complete modal__withdraw--wrap-overtime"
    class="modal__withdrawal--complete modal__withdrawal--cancel modal__withdrawal--overtime"
    :active="contractsStore.modal.overtime"
  >
    <div class="modal__title">Withdrawal Request</div>
    <div class="complete__description">
      {{ contractsStore.thresholdPrompt }}
    </div>
    <div class="process__statement" v-if="contractsStore.activeRequest">
      <div class="statement__label">Amount:</div>
      <div class="statement__value" v-if="contractsStore.activeChain">
        {{ formatWithAtLeastTwoDecimals(contractsStore.activeRequest.amount) }}
        {{ contractsStore.activeChain.currencies[0].name }}
      </div>
    </div>
    <div
      class="overtime__buttons"
      :class="{complete: contractsStore.activeRequest}"
    >
      <div class="cancel__button">
        <button
          type="button"
          aria-label="Cancel withdrawal request"
          @click="contractsStore.cancelWithdrawRequest"
        >
          Cancel withdrawal request
          <span class="loader" v-if="contractsStore.loading.cancelWithdraw">
            <span></span><span></span>
          </span>
        </button>
      </div>
      <div class="complete__button" v-if="contractsStore.activeRequest">
        <button
          type="button"
          aria-label="Complete withdrawal"
          @click="contractsStore.completeWithdraw"
        >
          Complete withdrawal
          <span class="loader" v-if="contractsStore.loading.withdraw">
            <span></span><span></span>
          </span>
        </button>
      </div>
    </div>
  </Modal>

  <!-- Main -->
  <div class="withdraw__screen--wrap">
    <div class="withdraw__screen">
      <div class="withdraw__screen--row">
        <h1 class="withdraw__screen--title">NAKA Fund Withdrawal</h1>
        <div class="withdraw__screen--subtitle">Your funds, your control.</div>
        <div class="withdraw__screen--text">
          Choose your withdrawal method and get your funds in just a few steps.
        </div>
      </div>

      <Tabs v-if="contractsStore.availableVaults.length > 1" />

      <div class="withdraw__screen--row withdraw__screen--connect">
        <WithdrawBox
          @click="openConnectedModal"
          title="Withdraw to connected wallet"
          description="Simply withdraw your funds to the currently connected wallet in your
      browser."
          buttonText="Withdraw connected"
        />
        <WithdrawBox
          @click="openExternalModal"
          title="Withdraw to external wallet"
          description="Insert an external wallet address and transfer your funds."
          buttonText="Withdraw external"
        />
        <div class="spacer"></div>
        <Card :amount="contractsStore.contractBalance.usdt" />
      </div>
      <HistoryList />
    </div>
  </div>
</template>
