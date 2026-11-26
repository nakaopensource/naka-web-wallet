<script setup lang="ts">
import type {IFormField} from '@/types/general.ts';
import {computed, ref, watch} from 'vue';
import {useContractsStore} from '@/stores/contracts.ts';
import {formatWithAtLeastTwoDecimals} from '@/utils/helpers.ts';
import CurrencySwitch from '@/components/UI/CurrencySwitch.vue';
import TokenIcon from '@/components/UI/TokenIcon.vue';

/*Props */
const props = defineProps<{
  resetAmount(): void;
  amountData: IFormField<number | null>;
  loading?: boolean;
  setMax(): void;
}>();

/*Global state*/
const contractsStore = useContractsStore();

/*Local state*/
const errorText = ref('');

/*Computed*/
const availableText = computed(() =>
  contractsStore.selectedBalance === null
    ? ''
    : `Available: ${formatWithAtLeastTwoDecimals(contractsStore.selectedBalance)} ${contractsStore.selectedCurrency}`
);

/*Methods*/
const updateError = (text: string) => {
  errorText.value = text;
};

const preventNegative = (event: any) => {
  /** Get inserted value from the input */
  const value = parseFloat(event.target.value);

  /** If the inserted value is equal or bigger than zero stop propagation */
  if (value >= 0 || isNaN(value) || !value) {
    return;
  }

  /** If the inserted value is less than zero replace it with zero and update the global state */
  event.target.value = 0;
  props.resetAmount();
};

/** Validate the amount against the selected token's available balance */
const checkBalance = () => {
  updateError('');

  if (!props.amountData.value || contractsStore.loading.vaultBalance) {
    return;
  }

  const available = contractsStore.selectedBalance;

  if (available === null) {
    updateError('Your balance could not be loaded. Please try again.');
    return;
  }

  if (props.amountData.value > available) {
    updateError('The entered amount is higher than your balance');
  }
};

/*Watchers*/
/** Re-check when the amount, the selected token or its balance changes */
watch(
  () => [
    props.amountData.value,
    contractsStore.currencyToken,
    contractsStore.selectedBalance,
    contractsStore.loading.vaultBalance
  ],
  () => {
    checkBalance();
  },
  {immediate: true}
);
</script>

<template>
  <div class="connected__form--step-amount">
    <div class="modal__title">Define amount</div>
    <div class="connected__form--fields">
      <CurrencySwitch
        v-if="contractsStore.tokens.length > 1"
        class="connected__form--switch"
        tone="light"
        label="Withdrawal currency"
        :options="contractsStore.tokens"
        v-model="contractsStore.currencyToken"
      />
      <div class="connected__form--amount">
        <div class="amount__wrap" :class="{error: errorText}">
          <input
            type="number"
            :required="props.amountData.required"
            min="0"
            @input="preventNegative"
            :step="contractsStore.amountDecimals"
            v-model="props.amountData.value"
          />
          <button
            v-if="props.amountData.value"
            type="reset"
            aria-label="Reset amount"
            @click="props.resetAmount"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clip-path="url(#clip0_5958_7667)">
                <path
                  d="M7 0C10.866 1.28851e-07 14 3.13401 14 7C14 10.866 10.866 14 7 14C3.13401 14 1.28855e-07 10.866 0 7C0 3.13401 3.13401 0 7 0ZM9.93457 4.06543C9.76372 3.89458 9.48628 3.89458 9.31543 4.06543L7 6.38086L4.68457 4.06543C4.51372 3.89458 4.23628 3.89458 4.06543 4.06543C3.89458 4.23628 3.89458 4.51372 4.06543 4.68457L6.38086 7L4.06543 9.31543C3.89458 9.48628 3.89458 9.76372 4.06543 9.93457C4.23628 10.1054 4.51372 10.1054 4.68457 9.93457L7 7.61914L9.31543 9.93457C9.48628 10.1054 9.76372 10.1054 9.93457 9.93457C10.1054 9.76372 10.1054 9.48628 9.93457 9.31543L7.61914 7L9.93457 4.68457C10.1054 4.51372 10.1054 4.23628 9.93457 4.06543Z"
                  fill="#939393"
                />
              </g>
              <defs>
                <clipPath id="clip0_5958_7667">
                  <rect width="14" height="14" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </button>
        </div>
        <div class="amount__wrap amount__wrap--currency">
          <div class="amount__currency" v-if="contractsStore.selectedCurrency">
            <div class="amount__currency--text">
              <TokenIcon :name="contractsStore.selectedCurrency" />
              {{ contractsStore.selectedCurrency }}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Set max amount"
          class="amount__max"
          @click="props.setMax"
        >
          MAX
        </button>
        <div class="error__text" v-if="errorText">
          {{ errorText }}
        </div>
        <div class="amount__hint" v-else-if="availableText">
          {{ availableText }}
        </div>
      </div>
    </div>
    <div class="connected__form--submit">
      <button
        class="submit__button"
        type="submit"
        aria-label="Submit form"
        :class="{
          active: props.amountData.value && !errorText,
          loading: props.loading
        }"
      >
        Confirm
        <span class="loader" v-if="props.loading">
          <span></span><span></span>
        </span>
      </button>
    </div>
  </div>
</template>
