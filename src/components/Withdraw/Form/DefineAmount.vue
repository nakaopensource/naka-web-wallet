<script setup lang="ts">
import type {IFormField} from '@/types/general.ts';
import {ref, watch} from 'vue';
import {useContractsStore} from '@/stores/contracts.ts';
import CurrencySwitch from '@/components/Withdraw/CurrencySwitch.vue';
import CurrencyIcon from '@/components/Withdraw/CurrencyIcon.vue';
import {formatWithAtLeastTwoDecimals} from '@/utils/helpers.ts';

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
const errorActive = ref(false);

/*Methods*/
const updateError = (active: boolean) => {
  errorActive.value = active;
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

const checkBalance = () => {
  updateError(false);

  if (!props.amountData.value) {
    return;
  }

  if (contractsStore.selectedBalance >= props.amountData.value) {
    return;
  }

  updateError(true);
};

/*Watchers*/
watch(
  () => [props.amountData.value, contractsStore.currencyToken],
  () => {
    checkBalance();
  }
);
</script>

<template>
  <div class="connected__form--step-amount">
    <div class="modal__title">Define amount</div>
    <CurrencySwitch />
    <div class="connected__form--amount">
      <div class="amount__wrap" :class="{error: errorActive}">
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
        <div class="amount__currency">
          <CurrencyIcon :name="contractsStore.selectedCurrency" />
          <div class="amount__currency--text">
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
      <div class="amount__available">
        Available:
        {{ formatWithAtLeastTwoDecimals(contractsStore.selectedBalance) }}
        {{ contractsStore.selectedCurrency }}
      </div>
      <div class="error__text" v-if="errorActive">
        The entered amount is higher than your balance
      </div>
    </div>
    <div class="connected__form--submit">
      <button
        class="submit__button"
        type="submit"
        aria-label="Submit form"
        :class="{
          active: props.amountData.value && !errorActive,
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
