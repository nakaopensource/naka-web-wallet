<script setup lang="ts">
import {useId} from 'vue';

/*Props*/
const props = defineProps<{name: string}>();

/** Unique gradient id per instance, so icons inside hidden elements never break each other */
const goldId = `token-gold-${useId()}`;
</script>

<template>
  <!-- USD₮0 (Polygon) -->
  <svg
    v-if="props.name === 'USDT0'"
    class="token-icon"
    viewBox="0 0 976 977"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="488.008" cy="488.324" r="487.965" fill="#00B988" />
    <path
      d="M238.48 233.252H737.533V344.152H543.459V455.054H432.557V344.152H238.48V233.252Z"
      fill="white"
    />
    <path d="M432.557 455.054V676.856H321.656V455.054H432.557Z" fill="white" />
    <path
      d="M543.475 676.856H654.36V455.054H543.459V676.856H432.574V787.757H543.475V676.856Z"
      fill="white"
    />
  </svg>

  <!-- USDT (Avalanche) -->
  <svg
    v-else-if="props.name === 'USDT'"
    class="token-icon"
    viewBox="0 0 32 32"
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path
      fill="#FFF"
      d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
    />
  </svg>

  <!-- XAU₮0: the ₮0 mark on gold -->
  <svg
    v-else-if="props.name === 'XAUT0'"
    class="token-icon"
    viewBox="0 0 976 977"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="goldId" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F6DC8A" />
        <stop offset="0.55" stop-color="#D9A93F" />
        <stop offset="1" stop-color="#B07E1F" />
      </linearGradient>
    </defs>
    <circle cx="488.008" cy="488.324" r="487.965" :fill="`url(#${goldId})`" />
    <path
      d="M238.48 233.252H737.533V344.152H543.459V455.054H432.557V344.152H238.48V233.252Z"
      fill="white"
    />
    <path d="M432.557 455.054V676.856H321.656V455.054H432.557Z" fill="white" />
    <path
      d="M543.475 676.856H654.36V455.054H543.459V676.856H432.574V787.757H543.475V676.856Z"
      fill="white"
    />
  </svg>

  <!-- USDC -->
  <svg
    v-else-if="props.name === 'USDC'"
    class="token-icon"
    viewBox="0 0 32 32"
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <circle
      cx="16"
      cy="16"
      r="10.5"
      fill="none"
      stroke="#FFF"
      stroke-width="1.6"
      stroke-dasharray="13 3.5"
      stroke-dashoffset="-1.5"
    />
    <text
      x="16"
      y="21.2"
      text-anchor="middle"
      font-size="14"
      font-weight="600"
      font-family="NeueMontreal, sans-serif"
      fill="#FFF"
    >
      $
    </text>
  </svg>

  <!-- Unknown token: monogram -->
  <span v-else class="token-icon token-icon--fallback" aria-hidden="true">
    {{ props.name.charAt(0) }}
  </span>
</template>
