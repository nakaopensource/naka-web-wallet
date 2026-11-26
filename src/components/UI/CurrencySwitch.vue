<script setup lang="ts">
import {computed} from 'vue';
import type {IToken} from '@/types/contracts.ts';
import SegmentedControl from '@/components/UI/SegmentedControl.vue';
import TokenIcon from '@/components/UI/TokenIcon.vue';

/**
 * Currency switch. Picking a token only changes what the app shows and
 * withdraws — it never changes the vault's payment token on-chain.
 */

/*Props*/
const props = withDefaults(
  defineProps<{
    options: IToken[];
    modelValue: string;
    tone?: 'dark' | 'light';
    label?: string;
    collapsible?: boolean;
  }>(),
  {tone: 'dark', label: 'Currency', collapsible: false}
);

const emit = defineEmits<{'update:modelValue': [value: string]}>();

/*Computed*/
const items = computed(() =>
  props.options.map((token) => ({value: token.value, label: token.name}))
);
</script>

<template>
  <SegmentedControl
    :options="items"
    :model-value="props.modelValue"
    :tone="props.tone"
    :label="props.label"
    :collapsible="props.collapsible"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #icon="{option}">
      <TokenIcon :name="option.label" />
    </template>
  </SegmentedControl>
</template>
