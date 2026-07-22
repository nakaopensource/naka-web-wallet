<script setup lang="ts">
import Loading from '@/components/Withdraw/List/Loading.vue';
import Empty from '@/components/Withdraw/List/Empty.vue';
import Withdrawal from '@/components/Withdraw/List/Withdrawal.vue';
import {useContractsStore} from '@/stores/contracts.ts';
import {watch} from 'vue';

/*Global state*/
const contractsStore = useContractsStore();

/*Watchers*/
watch(
  () => contractsStore.daysOffset,
  () => {
    contractsStore.updateHistoryList();
  }
);
</script>

<template>
  <div class="withdraw__screen--row withdraw__screen--history">
    <div class="history__title">Withdrawal History</div>
    <div class="history__list">
      <Empty
        v-if="
          !contractsStore.withdrawals.length && !contractsStore.loading.history
        "
      />
      <div
        class="history__list--grid"
        v-if="
          contractsStore.withdrawals.length && !contractsStore.loading.history
        "
      >
        <Withdrawal
          v-for="withdrawal in contractsStore.withdrawals"
          :withdrawal="withdrawal"
        />
      </div>
      <Loading v-if="contractsStore.loading.history" />
    </div>
    <div class="history__selector">
      <label for="days">Sort by time</label>
      <select
        id="days"
        class="history__selector--select"
        v-model="contractsStore.daysOffset"
        :disabled="contractsStore.loading.history"
      >
        <option v-for="time in contractsStore.timeList" :value="time.value">
          {{ time.text }}
        </option>
      </select>
    </div>
  </div>
</template>
