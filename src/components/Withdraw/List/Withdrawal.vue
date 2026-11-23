<script setup lang="ts">
import type {IWithdrawal} from '@/types/contracts.ts';
import {
  formatWithAtLeastTwoDecimals,
  localizeDateTime
} from '@/utils/helpers.ts';
import {useContractsStore} from '@/stores/contracts.ts';

/*Props*/
const props = defineProps<{
  withdrawal: IWithdrawal;
}>();

/*Global state*/
const contractsStore = useContractsStore();

/*Methods*/
/** If the withdrawal is a pending request give it an option to open a modal that will cancel its request otherwise stop propagation */
const openCancelModal = () => {
  if (props.withdrawal.status === 'complete') {
    return;
  }
  contractsStore.updateModal({cancelWithdraw: true});
};
</script>

<template>
  <!-- Main -->
  <div
    class="withdrawal__row"
    :class="`withdrawal__row--${props.withdrawal.status}`"
  >
    <div class="withdrawal__row--statement">
      <div class="withdrawal__icon">
        <div class="withdrawal__icon--status"></div>
        <svg
          width="18"
          height="19"
          viewBox="0 0 18 19"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g clip-path="url(#clip0_5964_5147)">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M16.8204 8.43721C16.9137 8.63314 16.8859 8.86525 16.7491 9.03366L9.43656 18.0337C9.32974 18.1651 9.16938 18.2415 8.99999 18.2415C8.83061 18.2415 8.67024 18.1651 8.56343 18.0337L1.25093 9.03366C1.11409 8.86525 1.08633 8.63314 1.17959 8.43721C1.27285 8.24127 1.4705 8.11645 1.68749 8.11645L5.62499 8.11645L5.62499 3.61645C5.62499 1.75217 7.13571 0.241455 8.99999 0.241455C10.8643 0.241455 12.375 1.75217 12.375 3.61645L12.375 8.11645L16.3125 8.11646C16.5295 8.11646 16.7271 8.24127 16.8204 8.43721Z"
              fill="#0C0C0C"
            />
          </g>
          <defs>
            <clipPath id="clip0_5964_5147">
              <rect
                width="18"
                height="18"
                fill="white"
                transform="translate(0 0.241455)"
              />
            </clipPath>
          </defs>
        </svg>
      </div>
      <div class="withdrawal__details">
        <span class="withdrawal__details--address">
          Withdraw: {{ props.withdrawal.address || 'Unknown recipient' }}
        </span>
        <div class="withdrawal__details--date">
          {{ localizeDateTime(props.withdrawal.date) }}
        </div>
      </div>
      <div class="withdrawal__amount" v-if="contractsStore.activeChain">
        -{{ formatWithAtLeastTwoDecimals(props.withdrawal.amount) }}
        {{
          contractsStore.activeChain.currencies.find(
            (item) =>
              item.value.toLowerCase() === props.withdrawal.token.toLowerCase()
          )?.name || contractsStore.activeChain.currencies[0].name
        }}
      </div>
    </div>
    <div class="withdrawal__row--button">
      <button
        class="cancel"
        type="button"
        aria-label="Cancel withdraw request"
        @click="openCancelModal"
        v-if="['ready', 'pending'].includes(props.withdrawal.status)"
      >
        Cancel withdraw
      </button>
      <button
        type="button"
        aria-label="Complete withdraw"
        @click="contractsStore.updateModal({completeWithdraw: true})"
        v-if="props.withdrawal.status === 'ready'"
      >
        Complete withdraw
      </button>
    </div>
  </div>
</template>
