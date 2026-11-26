import {describe, expect, it} from 'vitest';
import {CHAINS} from '@/utils/constants.ts';

/**
 * ABI contract tests.
 *
 * The ABI JSONs in src/assets/abi are the machine-readable spec of the
 * deployed Vault/Registry contracts. The store addresses methods, struct
 * keys and event params by string, so a rename or a "fixed typo" in a
 * redeployed contract would fail silently at runtime (undefined balances,
 * empty history) instead of at build time. These tests pin every name the
 * frontend depends on to what the ABI actually declares.
 */

interface AbiParam {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParam[];
}

interface AbiItem {
  type: string;
  name?: string;
  inputs?: AbiParam[];
  outputs?: AbiParam[];
}

const findFunction = (abi: AbiItem[], name: string) =>
  abi.find((item) => item.type === 'function' && item.name === name);

const findEvent = (abi: AbiItem[], name: string) =>
  abi.find((item) => item.type === 'event' && item.name === name);

const inputTypes = (item?: AbiItem) =>
  (item?.inputs ?? []).map((input) => input.type);

const structKeys = (item?: AbiItem) =>
  (item?.outputs?.[0]?.components ?? []).map((component) => component.name);

/**
 * The balance-struct key the store reads per chain
 * (contracts.ts -> getVaultBalance). The Polygon contract was deployed
 * with a typo ("avaliableBalance") which the frontend must mirror; Avax
 * has the corrected spelling. If either assertion ever fails after an ABI
 * update, the ternary in getVaultBalance must be updated in the same
 * commit — that is the entire point of this test.
 */
const BALANCE_KEY_BY_CHAIN: Record<number, string> = {
  137: 'avaliableBalance',
  43114: 'availableBalance'
};

/** Events the store reads via getPastEvents / decodeLog */
const REQUIRED_EVENTS = [
  'WithdrawRequest',
  'Withdrawal',
  'CanceledWithdrawReservation',
  'ContractInitialized'
];

describe.each(CHAINS.map((chain) => [chain.name, chain] as const))(
  '%s ABI contract',
  (_name, chain) => {
    const vaultAbi = chain.vaultAbi as AbiItem[];
    const registryAbi = chain.registryAbi as AbiItem[];

    describe('vault methods called by the store', () => {
      it.each([
        ['withdrawRequest', ['address', 'address', 'uint256']],
        ['withdraw', ['address', 'address', 'uint256']],
        ['cancelWithdrawRequest', ['address']]
      ])('%s exists with the expected input signature', (method, inputs) => {
        const fn = findFunction(vaultAbi, method);
        expect(fn, `${method} missing from vault ABI`).toBeDefined();
        expect(inputTypes(fn)).toEqual(inputs);
      });

      it(`config balanceCall "${chain.balanceCall}" exists on the vault`, () => {
        expect(findFunction(vaultAbi, chain.balanceCall)).toBeDefined();
      });

      it(`config reservationCall "${chain.reservationCall}" exists on the vault`, () => {
        expect(findFunction(vaultAbi, chain.reservationCall)).toBeDefined();
      });
    });

    describe('registry methods called by the store', () => {
      it.each([
        ['createVault', ['address']],
        ['getVaultAddressByOwner', ['address']]
      ])('%s exists with the expected input signature', (method, inputs) => {
        const fn = findFunction(registryAbi, method);
        expect(fn, `${method} missing from registry ABI`).toBeDefined();
        expect(inputTypes(fn)).toEqual(inputs);
      });

      it(`config reservationLockCall "${chain.reservationLockCall}" exists on the registry`, () => {
        const fn = findFunction(registryAbi, chain.reservationLockCall);
        expect(fn).toBeDefined();
        expect(fn?.outputs?.map((output) => output.type)).toEqual(['uint256']);
      });
    });

    describe('struct keys read by the store', () => {
      it('balance struct contains the exact key getVaultBalance reads', () => {
        const balanceFn = findFunction(vaultAbi, chain.balanceCall);
        expect(structKeys(balanceFn)).toContain(BALANCE_KEY_BY_CHAIN[chain.id]);
      });

      it("balance struct does NOT contain the other chain's spelling", () => {
        /**
         * Guards the inverse: if Polygon ever ships "availableBalance"
         * (typo fixed) this fails loudly instead of the UI showing 0.
         */
        const balanceFn = findFunction(vaultAbi, chain.balanceCall);
        const otherSpelling =
          chain.id === 137 ? 'availableBalance' : 'avaliableBalance';
        expect(structKeys(balanceFn)).not.toContain(otherSpelling);
      });

      it('reservation struct exposes amount and unlockTime (IReservation)', () => {
        const reservationFn = findFunction(vaultAbi, chain.reservationCall);
        expect(structKeys(reservationFn)).toEqual(
          expect.arrayContaining(['amount', 'unlockTime'])
        );
      });
    });

    describe('per-token balance and reservation reads', () => {
      const sources = chain.currencies.map((currency) => currency.balanceSource);

      it('only the first currency reads the protocol-token struct', () => {
        sources.forEach((source, index) => {
          if (source === 'protocolToken') {
            expect(index).toBe(0);
          }
        });
      });

      it.runIf(sources.includes('paymentTokenId'))(
        'vault exposes per-token-id balances with availableBalance',
        () => {
          const fn = findFunction(vaultAbi, 'getPaymentTokenBalancesByTokenId');
          expect(inputTypes(fn)).toEqual(['uint16']);
          expect(structKeys(fn)).toContain('availableBalance');
        }
      );

      it.runIf(sources.includes('paymentTokenId'))(
        'vault exposes per-token-id withdrawal reservations (amount, unlockTime)',
        () => {
          const fn = findFunction(
            vaultAbi,
            'getWithdrawPaymentTokenReservationByTokenId'
          );
          expect(inputTypes(fn)).toEqual(['uint16']);
          expect(structKeys(fn)).toEqual(
            expect.arrayContaining(['amount', 'unlockTime'])
          );
        }
      );

      it.runIf(sources.includes('paymentTokenId'))(
        'registry resolves token ids with getWhitelistedTokenId(address)',
        () => {
          const fn = findFunction(registryAbi, 'getWhitelistedTokenId');
          expect(inputTypes(fn)).toEqual(['address']);
          expect(fn?.outputs?.map((output) => output.type)).toEqual(['uint16']);
        }
      );
    });

    describe('events read by the store', () => {
      it.each(REQUIRED_EVENTS)('%s exists in the vault ABI', (eventName) => {
        expect(findEvent(vaultAbi, eventName)).toBeDefined();
      });

      it('WithdrawRequest exposes token, amount and unlockTime', () => {
        const event = findEvent(vaultAbi, 'WithdrawRequest');
        expect((event?.inputs ?? []).map((input) => input.name)).toEqual(
          expect.arrayContaining(['token', 'amount', 'unlockTime'])
        );
      });

      it('Withdrawal exposes token, recipient and amount', () => {
        /** getCompletedWithdrawals reads returnValues.recipient/amount/token */
        const event = findEvent(vaultAbi, 'Withdrawal');
        expect((event?.inputs ?? []).map((input) => input.name)).toEqual(
          expect.arrayContaining(['token', 'recipient', 'amount'])
        );
      });

      it('CanceledWithdrawReservation matches the hardcoded decodeLog shape', () => {
        /**
         * findRecipientForCancellation decodes with a hardcoded schema:
         * [{indexed: true, name: 'token', type: 'address'},
         *  {indexed: false, name: 'amount', type: 'uint256'}]
         * If the event shape drifts, decoding returns garbage — pin it.
         */
        const event = findEvent(vaultAbi, 'CanceledWithdrawReservation');
        expect(
          (event?.inputs ?? []).map(({name, type, indexed}) => ({
            name,
            type,
            indexed
          }))
        ).toEqual([
          {name: 'token', type: 'address', indexed: true},
          {name: 'amount', type: 'uint256', indexed: false}
        ]);
      });
    });
  }
);
