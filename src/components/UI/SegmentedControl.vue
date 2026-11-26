<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';

/**
 * Segmented control (radio group) with a sliding indicator.
 * Use the `icon` slot to render something before each label.
 */

export interface ISegmentedOption {
  value: string;
  label: string;
}

/*Props*/
const props = withDefaults(
  defineProps<{
    options: ISegmentedOption[];
    modelValue: string;
    tone?: 'dark' | 'light';
    label: string;
    /** On phones, collapse inactive options to their icon */
    collapsible?: boolean;
  }>(),
  {tone: 'light', collapsible: false}
);

const emit = defineEmits<{'update:modelValue': [value: string]}>();

defineSlots<{icon?(props: {option: ISegmentedOption}): unknown}>();

/*Local state*/
const track = ref<HTMLElement | null>(null);
const indicator = ref({left: 0, width: 0, ready: false});

/*Computed*/
const activeIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex(
      (option) => option.value.toLowerCase() === props.modelValue.toLowerCase()
    )
  )
);

/*Methods*/
const optionElements = () =>
  Array.from(
    track.value?.querySelectorAll<HTMLElement>('.segmented__option') ?? []
  );

/** Slide the indicator under the active option */
const measure = () => {
  const active = optionElements()[activeIndex.value];

  if (!active) {
    return;
  }

  indicator.value = {
    left: active.offsetLeft,
    width: active.offsetWidth,
    ready: true
  };
};

const select = (value: string) => {
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
  }
};

/** Radio-group keyboard pattern: arrows move the selection and the focus */
const onKeydown = (event: KeyboardEvent) => {
  const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[
    event.key
  ];

  if (!step) {
    return;
  }

  event.preventDefault();
  const next =
    (activeIndex.value + step + props.options.length) % props.options.length;
  select(props.options[next].value);
  nextTick(() => optionElements()[next]?.focus());
};

/*Lifecycle*/
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  measure();

  /** Re-measure when the layout or the web font changes option widths */
  if (typeof ResizeObserver !== 'undefined' && track.value) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(track.value);
  }
  document.fonts?.ready.then(measure);
});

onBeforeUnmount(() => resizeObserver?.disconnect());

/*Watchers*/
watch(
  () => [props.modelValue, props.options.map((option) => option.value).join()],
  () => nextTick(measure)
);
</script>

<template>
  <div
    ref="track"
    class="segmented"
    :class="[
      `segmented--${props.tone}`,
      {'segmented--collapsible': props.collapsible}
    ]"
    role="radiogroup"
    :aria-label="props.label"
    @keydown="onKeydown"
  >
    <span
      class="segmented__indicator"
      :class="{ready: indicator.ready}"
      :style="{
        width: `${indicator.width}px`,
        transform: `translateX(${indicator.left}px)`
      }"
      aria-hidden="true"
    ></span>
    <button
      v-for="(option, index) in props.options"
      :key="option.value"
      type="button"
      role="radio"
      class="segmented__option"
      :class="{active: index === activeIndex, 'with-icon': !!$slots.icon}"
      :aria-checked="index === activeIndex"
      :aria-label="option.label"
      :title="option.label"
      :tabindex="index === activeIndex ? 0 : -1"
      @click="select(option.value)"
    >
      <slot name="icon" :option="option" />
      <span class="segmented__label">{{ option.label }}</span>
    </button>
  </div>
</template>
