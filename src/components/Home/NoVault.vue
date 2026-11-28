<script setup lang="ts">
import {useContractsStore} from '@/stores/contracts.ts';
import {shortenAddress} from '@/utils/helpers.ts';

/*Global state*/
const contractsStore = useContractsStore();
</script>

<template>
  <div class="home">
    <div class="home__box">
      <div class="home__box--title-wrap">
        <h1 class="home__box--title">No vault found</h1>
      </div>
      <p class="home__box--text">
        There is no vault for
        {{ shortenAddress(contractsStore.connectedAccount) }} on
        {{ contractsStore.activeChain?.name }}. Connect the wallet created with
        your NAKA Pay recovery phrase, or switch network in MetaMask.
      </p>
      <div class="home__box--button">
        <button
          class="button__default home__button--connect"
          type="button"
          aria-label="Use another account"
          @click="contractsStore.connectMetamask(true)"
        >
          <span class="button__text">Use another account</span>
        </button>
      </div>
    </div>
  </div>
</template>
