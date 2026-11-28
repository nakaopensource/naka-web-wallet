<script setup lang="ts">
import {RouterLink} from 'vue-router';
import {useContractsStore} from '@/stores/contracts.ts';
import Modal from '@/components/UI/Modal.vue';
import {copyToClipboard, shortenAddress} from '@/utils/helpers.ts';

/*Global state*/
const contractsStore = useContractsStore();

/*Modal*/
const disconnectMetamask = () => {
  contractsStore.disconnectWallet();
};

const copyAddress = () => {
  copyToClipboard(contractsStore.connectedAccount);
};
</script>

<template>
  <!-- Modal -->
  <Modal
    class="modal__connect"
    :closeModal="() => contractsStore.updateModal({connect: false})"
    :active="contractsStore.modal.connect"
  >
    <div class="connect__header">Connected</div>
    <div class="connect__profile">
      <div class="profile">
        <div class="network">
          <img
            :src="contractsStore.activeNetwork.icon"
            :alt="contractsStore.activeNetwork.name"
            width="30"
            height="30"
            class="network__icon"
          />
          <div class="network__name">
            {{ contractsStore.activeNetwork.name }}
          </div>
        </div>
      </div>
    </div>
    <div class="connect__address" @click="copyAddress">
      <span>
        {{ shortenAddress(contractsStore.connectedAccount) }}
      </span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M1.04199 1.66797C1.04199 1.32279 1.32181 1.04297 1.66699 1.04297H13.3337C13.6788 1.04297 13.9587 1.32279 13.9587 1.66797V6.04297H18.3337C18.6788 6.04297 18.9587 6.32279 18.9587 6.66797V18.3346C18.9587 18.6798 18.6788 18.9596 18.3337 18.9596H6.66699C6.32181 18.9596 6.04199 18.6798 6.04199 18.3346V13.9596H1.66699C1.32181 13.9596 1.04199 13.6798 1.04199 13.3346V1.66797ZM7.29199 13.9596V17.7096H17.7087V7.29297H13.9587V13.3346C13.9587 13.6798 13.6788 13.9596 13.3337 13.9596H7.29199ZM12.7087 2.29297H2.29199V12.7096H12.7087V2.29297Z"
        />
      </svg>
    </div>
    <div class="connect__amount">
      <span :class="{loading: contractsStore.loading.balance}">
        {{ contractsStore.balance }} {{ contractsStore.activeNetwork.symbol }}
      </span>
    </div>
    <div class="connect__button">
      <button
        type="button"
        aria-label="Disconnect from MetaMask"
        @click="disconnectMetamask"
        class="button__default"
      >
        <svg
          aria-hidden="true"
          width="15"
          height="14"
          viewBox="0 0 15 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M4 0C1.79086 0 0 1.79086 0 4V10C0 12.2091 1.79086 14 4 14H6C6.55228 14 7 13.5523 7 13C7 12.4477 6.55228 12 6 12H4C2.89543 12 2 11.1046 2 10V4C2 2.89543 2.89543 2 4 2H6C6.55228 2 7 1.55228 7 1C7 0.447715 6.55228 0 6 0H4ZM11.7071 3.29289C11.3166 2.90237 10.6834 2.90237 10.2929 3.29289C9.90237 3.68342 9.90237 4.31658 10.2929 4.70711L11.5858 6H9.5H6C5.44772 6 5 6.44772 5 7C5 7.55228 5.44772 8 6 8H9.5H11.5858L10.2929 9.29289C9.90237 9.68342 9.90237 10.3166 10.2929 10.7071C10.6834 11.0976 11.3166 11.0976 11.7071 10.7071L14.7071 7.70711C15.0976 7.31658 15.0976 6.68342 14.7071 6.29289L11.7071 3.29289Z"
          ></path>
        </svg>
        <span>Disconnect</span>
      </button>
    </div>
  </Modal>

  <!-- Header -->
  <header>
    <div class="header__wrapper">
      <nav>
        <RouterLink to="/" class="nav__logo">
          <img src="@/assets/img/naka.svg" alt="Logo" width="81" height="19" />
        </RouterLink>
        <div class="header__wrapper--connect">
          <button
            class="button__default button__connect"
            aria-label="Connect with MetaMask"
            type="button"
            :class="{
              connected:
                contractsStore.vaultContract && !contractsStore.loading.connect
            }"
            @click="contractsStore.connectMetamask(true)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="button__connect--icon"
              v-if="
                contractsStore.vaultContract && !contractsStore.loading.connect
              "
            >
              <g id="Group">
                <path
                  id="Vector"
                  d="M14.6667 0H4V2.66667H14.6667V0Z"
                  fill="#C6FC50"
                />
                <path
                  id="Vector_2"
                  d="M15.3333 4.00016H2C1.63267 4.00016 1.33333 3.70083 1.33333 3.3335C1.33333 2.96616 1.63267 2.66683 2 2.66683H2.66667V1.3335H2C0.895333 1.3335 0 2.22883 0 3.3335V13.3335C0 14.8062 1.194 16.0002 2.66667 16.0002H15.3333C15.7013 16.0002 16 15.7015 16 15.3335V4.66683C16 4.29883 15.7013 4.00016 15.3333 4.00016ZM12 11.3335C11.2633 11.3335 10.6667 10.7368 10.6667 10.0002C10.6667 9.2635 11.2633 8.66683 12 8.66683C12.7367 8.66683 13.3333 9.2635 13.3333 10.0002C13.3333 10.7368 12.7367 11.3335 12 11.3335Z"
                  fill="#C6FC50"
                />
              </g>
            </svg>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              :class="{loading: contractsStore.loading.connect}"
              v-if="
                !contractsStore.vaultContract || contractsStore.loading.connect
              "
              class="button__connect--icon"
            >
              <path
                d="M13.8474 11.0386L12.9135 10.0486C13.4675 9.89287 13.9147 9.58656 14.255 9.12967C14.5953 8.67279 14.7654 8.14578 14.7654 7.54864C14.7654 6.83776 14.5227 6.23047 14.0373 5.72676C13.5519 5.22305 12.9663 4.97119 12.2804 4.97119H9.7637C9.5888 4.97119 9.44219 4.91011 9.32387 4.78795C9.20557 4.66578 9.14642 4.5144 9.14642 4.33381C9.14642 4.15321 9.20557 4.00192 9.32387 3.87994C9.44219 3.75797 9.5888 3.69698 9.7637 3.69698H12.2804C13.3095 3.69698 14.1867 4.07288 14.912 4.82467C15.6373 5.57648 16 6.48572 16 7.55238C16 8.30495 15.8043 8.99244 15.4128 9.61486C15.0213 10.2373 14.4995 10.7118 13.8474 11.0386ZM10.9983 8.05554L9.8935 6.91527H10.6343C10.8091 6.91527 10.9557 6.97664 11.0741 7.09938C11.1924 7.22212 11.2515 7.37421 11.2515 7.55565C11.2515 7.66237 11.229 7.75888 11.184 7.84518C11.139 7.93147 11.0771 8.00159 10.9983 8.05554ZM15.3194 15.8154C15.2002 15.9385 15.0556 16 14.8857 16C14.7158 16 14.5713 15.9385 14.4521 15.8154L0.174988 1.07982C0.0610207 0.962207 0.00272007 0.814366 8.62549e-05 0.636297C-0.00256128 0.458242 0.0557393 0.307675 0.174988 0.184597C0.294223 0.0615325 0.438781 0 0.608662 0C0.778543 0 0.923101 0.0615325 1.04234 0.184597L15.3194 14.9202C15.4334 15.0378 15.4917 15.1857 15.4943 15.3637C15.497 15.5418 15.4387 15.6923 15.3194 15.8154ZM4.09721 11.4078C3.06374 11.4078 2.1828 11.0319 1.45438 10.2801C0.72597 9.52827 0.361763 8.61904 0.361763 7.55238C0.361763 6.60813 0.656434 5.7796 1.24578 5.06678C1.83512 4.35396 2.57456 3.9235 3.46411 3.77539H3.65405L4.81266 4.97119H4.09721C3.40604 4.97119 2.81644 5.22305 2.3284 5.72676C1.84036 6.23047 1.59634 6.83901 1.59634 7.55238C1.59634 8.26575 1.84036 8.87428 2.3284 9.378C2.81644 9.88171 3.40728 10.1336 4.10094 10.1336H6.59806C6.77296 10.1336 6.91957 10.1946 7.03789 10.3168C7.15619 10.439 7.21534 10.5904 7.21534 10.7709C7.21534 10.9515 7.15619 11.1028 7.03789 11.2248C6.91957 11.3468 6.77296 11.4078 6.59806 11.4078H4.09721ZM5.7275 8.18948C5.55262 8.18948 5.40601 8.1284 5.2877 8.00624C5.16938 7.88407 5.11022 7.73269 5.11022 7.5521C5.11022 7.3715 5.16938 7.22021 5.2877 7.09823C5.40601 6.97626 5.55262 6.91527 5.7275 6.91527H6.70889L7.92289 8.18948H5.7275Z"
                fill="#F8F8F8"
              />
            </svg>
            <span>
              {{
                !contractsStore.vaultContract || contractsStore.loading.connect
                  ? 'Connect'
                  : 'Connected'
              }}
            </span>
          </button>
        </div>
      </nav>
    </div>
  </header>
</template>
